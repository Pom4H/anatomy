import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const chrome = process.argv[2];
const pageUrl = process.argv[3];
if (!chrome || !pageUrl) {
  throw new Error('Usage: node scripts/prove-wallet-browser.mjs <chrome> <url>');
}

const port = 9_300 + (process.pid % 300);
const profile = `/tmp/anatomy-wallet-proof-${process.pid}`;
await rm(profile, { recursive: true, force: true });

let chromeStderr = '';
const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  `--remote-debugging-port=${port}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  pageUrl,
], {
  stdio: ['ignore', 'ignore', 'pipe'],
});

browser.stderr.setEncoding('utf8');
browser.stderr.on('data', (chunk) => {
  chromeStderr = `${chromeStderr}${chunk}`.slice(-24_000);
});

const cleanup = async () => {
  if (!browser.killed) browser.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    delay(2_000),
  ]);
  if (!browser.killed) browser.kill('SIGKILL');
  await rm(profile, { recursive: true, force: true });
};

async function waitForTarget(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(`Chrome exited before exposing CDP (code ${browser.exitCode})\n${chromeStderr}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find((candidate) =>
          candidate.type === 'page' && candidate.url.includes('/hardware-wallet/'),
        ) ?? targets.find((candidate) => candidate.type === 'page');
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chrome CDP target\n${chromeStderr}`);
}

function orderedSubsequence(actual, expected) {
  let cursor = 0;
  for (const value of actual) {
    if (value === expected[cursor]) cursor += 1;
    if (cursor === expected.length) return true;
  }
  return false;
}

try {
  const target = await waitForTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out opening CDP WebSocket')), 10_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', (event) => {
      clearTimeout(timer);
      reject(new Error(`CDP WebSocket failed: ${event.message ?? 'unknown error'}`));
    }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', async (event) => {
    let raw;
    if (typeof event.data === 'string') raw = event.data;
    else if (event.data instanceof ArrayBuffer) raw = Buffer.from(event.data).toString('utf8');
    else if (ArrayBuffer.isView(event.data)) raw = Buffer.from(event.data.buffer).toString('utf8');
    else if (typeof event.data?.text === 'function') raw = await event.data.text();
    else return;

    const message = JSON.parse(raw);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
    else entry.resolve(message.result ?? {});
  });

  const command = (method, params = {}, timeoutMs = 15_000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for CDP command ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer, method });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'Runtime.evaluate failed');
    }
    return result.result?.value;
  };

  await command('Runtime.enable');
  await command('Page.enable');

  const waitForTitle = async (expected, timeoutMs = 30_000) => {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      last = await evaluate(`document.querySelector('ee-hardware-wallet[data-reference-device]')?.getAttribute('screen-title') ?? null`);
      if (last === expected) return;
      if (last === 'EMULATOR ERROR') {
        const footer = await evaluate(`document.querySelector('ee-hardware-wallet[data-reference-device]')?.getAttribute('screen-footer') ?? ''`);
        throw new Error(`Wallet twin failed closed in Chrome: ${footer}`);
      }
      await delay(20);
    }
    throw new Error(`Timed out waiting for ${expected}; last screen was ${String(last)}`);
  };

  const clickPhysicalButton = async (part) => {
    const clicked = await evaluate(`(() => {
      const device = document.querySelector('ee-hardware-wallet[data-reference-device]');
      const button = device?.shadowRoot?.querySelector('[data-part="${part}"]');
      if (!button) return false;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      return true;
    })()`);
    if (!clicked) throw new Error(`Could not click physical ${part}`);
  };

  await waitForTitle('WALLET LOCKED');
  const observerInstalled = await evaluate(`(() => {
    const device = document.querySelector('ee-hardware-wallet[data-reference-device]');
    const iframe = document.querySelector('.circuit-lab iframe');
    if (!device || !iframe) return false;
    const proof = window.__walletTwinProof = { frames: [], circuits: [] };
    const recordFrame = () => {
      const frame = {
        title: device.getAttribute('screen-title') ?? '',
        state: device.getAttribute('state') ?? '',
        left: device.getAttribute('left-label') ?? '',
        right: device.getAttribute('right-label') ?? '',
      };
      const previous = proof.frames.at(-1);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(frame)) proof.frames.push(frame);
    };
    const recordCircuit = () => {
      const src = iframe.getAttribute('src') ?? '';
      if (proof.circuits.at(-1) !== src) proof.circuits.push(src);
    };
    new MutationObserver(recordFrame).observe(device, { attributes: true });
    new MutationObserver(recordCircuit).observe(iframe, { attributes: true, attributeFilter: ['src'] });
    recordFrame();
    recordCircuit();
    return true;
  })()`);
  if (!observerInstalled) throw new Error('Could not install wallet proof observers');

  await clickPhysicalButton('button-right');
  await waitForTitle('DEVICE READY');
  await delay(160);

  await clickPhysicalButton('button-right');
  await waitForTitle('REVIEW TRANSACTION');
  await delay(160);

  const review = await evaluate(`(() => {
    const device = document.querySelector('ee-hardware-wallet[data-reference-device]');
    return { left: device?.getAttribute('left-label'), right: device?.getAttribute('right-label') };
  })()`);
  if (review.left !== 'REJECT' || review.right !== 'CONFIRM') {
    throw new Error(`Firmware-owned review labels are wrong: ${JSON.stringify(review)}`);
  }

  await clickPhysicalButton('button-right');
  await waitForTitle('SIGNATURE READY');
  await delay(160);

  const proof = await evaluate(`window.__walletTwinProof`);
  const titles = proof.frames.map((frame) => frame.title);
  const expected = [
    'WALLET LOCKED',
    'DEVICE READY',
    'REVIEW TRANSACTION',
    'APPROVED',
    'SIGNATURE READY',
  ];
  if (!orderedSubsequence(titles, expected)) {
    throw new Error(`Browser missed the executable firmware path: ${titles.join(' -> ')}`);
  }
  if (!proof.circuits.some((src) => src.includes('display=1') && src.includes('signing=1'))) {
    throw new Error(`NodeSpice never received the signing load: ${proof.circuits.join(' | ')}`);
  }

  const evidence = await evaluate(`(() => {
    const lab = document.querySelector('[data-device-lab]');
    return {
      domain: lab?.querySelector('[data-domain-state]')?.textContent ?? '',
      firmware: lab?.querySelector('[data-firmware-state]')?.textContent ?? '',
      emulator: lab?.querySelector('[data-emulator-state]')?.textContent ?? '',
      circuit: lab?.querySelector('[data-circuit-state]')?.textContent ?? '',
    };
  })()`);
  if (!evidence.domain.includes('state 4') || !evidence.firmware.includes('signature ready')) {
    throw new Error(`Evidence rail does not reflect signed firmware state: ${JSON.stringify(evidence)}`);
  }

  console.log([
    `Chrome physical twin: ${titles.join(' -> ')}`,
    `Review buttons: ${review.left} / ${review.right}`,
    `NodeSpice states: ${proof.circuits.length} source transitions, signing load observed`,
    `Evidence: ${evidence.domain}; ${evidence.emulator}`,
  ].join('\n'));

  socket.close();
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  if (chromeStderr) console.error(`--- Chrome stderr ---\n${chromeStderr}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
