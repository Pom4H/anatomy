import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [chrome, pageUrl] = process.argv.slice(2);
if (!chrome || !pageUrl) {
  throw new Error('Usage: node scripts/prove-transfer-security.mjs <chrome> <url>');
}

const port = 9_650 + (process.pid % 200);
const profile = `/tmp/anatomy-transfer-proof-${process.pid}`;
await rm(profile, { recursive: true, force: true });

let stderr = '';
const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  `--remote-debugging-port=${port}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  pageUrl,
], { stdio: ['ignore', 'ignore', 'pipe'] });

browser.stderr.setEncoding('utf8');
browser.stderr.on('data', (chunk) => {
  stderr = `${stderr}${chunk}`.slice(-20_000);
});

const waitForExit = async (timeoutMs) => {
  if (browser.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    delay(timeoutMs),
  ]);
};

const cleanup = async () => {
  if (browser.exitCode === null) browser.kill('SIGTERM');
  await waitForExit(1_500);
  if (browser.exitCode === null) browser.kill('SIGKILL');
  await rm(profile, { recursive: true, force: true }).catch(() => {});
};

try {
  let target = null;
  const targetDeadline = Date.now() + 20_000;
  while (Date.now() < targetDeadline && !target) {
    if (browser.exitCode !== null) throw new Error(`Chrome exited early\n${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        target = targets.find((candidate) => candidate.type === 'page' && candidate.url.includes('/hardware-wallet/'));
      }
    } catch {
      // Chrome is still starting.
    }
    if (!target) await delay(100);
  }
  if (!target?.webSocketDebuggerUrl) throw new Error(`No Chrome page target\n${stderr}`);

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP socket timeout')), 10_000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP socket failed')); }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', async (event) => {
    const raw = typeof event.data === 'string' ? event.data : await event.data.text?.();
    if (!raw) return;
    const message = JSON.parse(raw);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result ?? {});
  });

  const command = (method, params = {}, timeoutMs = 15_000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out: ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const response = await command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? 'Runtime.evaluate failed');
    }
    return response.result?.value;
  };

  await command('Runtime.enable');

  const snapshot = () => evaluate(`(() => {
    const scene = document.querySelector('[data-wallet-transfer-scene]');
    const security = document.querySelector('[data-wallet-security]');
    return {
      stage: scene?.dataset.stage ?? null,
      senderBalance: scene?.querySelector('[data-sender-balance]')?.textContent?.trim() ?? null,
      receiverBalance: scene?.querySelector('[data-receiver-balance]')?.textContent?.trim() ?? null,
      txState: scene?.querySelector('[data-transfer-tx-state]')?.textContent?.trim() ?? null,
      txid: scene?.querySelector('[data-transfer-txid]')?.textContent?.trim() ?? null,
      senderTitle: scene?.querySelector('[data-transfer-sender]')?.getAttribute('screen-title') ?? null,
      receiverTitle: scene?.querySelector('[data-transfer-receiver]')?.getAttribute('screen-title') ?? null,
      receiverConnected: scene?.querySelector('[data-transfer-receiver]')?.hasAttribute('connected') ?? null,
      transferDevices: scene?.querySelectorAll('ee-hardware-wallet').length ?? 0,
      securityPresent: Boolean(security),
      memoryVerdict: security?.querySelector('[data-memory-verdict]')?.textContent?.trim() ?? null,
      memoryMatches: security?.querySelector('[data-memory-matches]')?.textContent?.trim() ?? null,
      memoryLine0: security?.querySelector('[data-memory-line="0"]')?.textContent?.trim() ?? null,
      transcript: security?.querySelector('[data-se-transcript]')?.textContent ?? null,
    };
  })()`);

  const waitFor = async (predicate, label, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      last = await snapshot();
      if (predicate(last)) return last;
      await delay(30);
    }
    throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last)}`);
  };

  const click = async (selector) => {
    const ok = await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!(node instanceof HTMLButtonElement) || node.disabled) return false;
      node.click();
      return true;
    })()`);
    if (!ok) throw new Error(`Could not click ${selector}`);
  };

  let view = await waitFor(
    (candidate) => candidate.stage === 'verify-receiver' && candidate.transferDevices === 2 && candidate.securityPresent,
    'two-wallet scene initialization',
  );
  if (view.receiverBalance !== '0.03000 BTC' || view.senderBalance !== '0.52000 BTC') {
    throw new Error(`Wrong opening balances: ${JSON.stringify(view)}`);
  }

  await click('[data-receiver-confirm]');
  view = await waitFor((candidate) => candidate.stage === 'review-intro', 'receiver address verification');
  if (view.receiverConnected !== false || view.receiverTitle !== 'ADDRESS VERIFIED') {
    throw new Error(`Receiver did not become safely disconnectable: ${JSON.stringify(view)}`);
  }

  await click('[data-sender-right]');
  await waitFor((candidate) => candidate.stage === 'amount' && candidate.senderTitle === 'AMOUNT', 'amount review');
  await click('[data-sender-right]');
  await waitFor((candidate) => candidate.stage === 'recipient' && candidate.senderTitle === 'RECIPIENT', 'recipient review');
  await click('[data-sender-right]');
  await waitFor((candidate) => candidate.stage === 'approve' && candidate.senderTitle === 'APPROVE', 'explicit approval page');

  await click('[data-sender-confirm]');
  await waitFor((candidate) => candidate.stage === 'signing' && candidate.senderTitle === 'APPROVED', 'physical signing chord');
  await waitFor((candidate) => candidate.stage === 'broadcast' && candidate.txid !== '—', 'broadcast');
  view = await waitFor((candidate) => candidate.stage === 'confirmed', 'network confirmation', 12_000);
  if (view.senderBalance !== '0.41988 BTC' || view.receiverBalance !== '0.03000 BTC') {
    throw new Error(`Settlement/local-sync boundary is wrong: ${JSON.stringify(view)}`);
  }

  await click('[data-receiver-sync]');
  view = await waitFor((candidate) => candidate.stage === 'complete', 'receiver account sync');
  if (view.receiverBalance !== '0.13000 BTC' || view.txState !== 'confirmed · synced') {
    throw new Error(`Receiver did not observe the settled UTXO: ${JSON.stringify(view)}`);
  }

  // The article must be honest about the current software backend.
  view = await snapshot();
  if (!view.memoryVerdict?.startsWith('FAIL') || !view.memoryMatches?.includes('1+') || !view.memoryLine0?.startsWith('5A 5B 5C')) {
    throw new Error(`Prototype memory-isolation failure is hidden: ${JSON.stringify(view)}`);
  }

  await click('[data-security-mode="secure-element"]');
  view = await waitFor(
    (candidate) => candidate.memoryVerdict?.startsWith('PASS') && candidate.memoryMatches === 'canary matches: 0',
    'secure-element isolation target',
  );
  if (!view.transcript?.includes('private_scalar') || !view.transcript.includes('forbidden')) {
    throw new Error(`Secure-element transcript does not state the forbidden secret boundary: ${JSON.stringify(view)}`);
  }

  console.log('Two-wallet E2E: B verified address -> A reviewed -> chord signed -> broadcast -> confirmed -> B synced');
  console.log(`Balances: A ${view.senderBalance}; B ${view.receiverBalance}; tx ${view.txid}`);
  console.log('Security inspector: current software backend FAIL is visible; target secure-element boundary PASS is explicit');
  socket.close();
} finally {
  await cleanup();
}
