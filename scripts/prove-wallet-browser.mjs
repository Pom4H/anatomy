import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [chrome, pageUrl] = process.argv.slice(2);
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
], { stdio: ['ignore', 'ignore', 'pipe'] });

browser.stderr.setEncoding('utf8');
browser.stderr.on('data', (chunk) => {
  chromeStderr = `${chromeStderr}${chunk}`.slice(-30_000);
});

async function waitForExit(timeoutMs) {
  if (browser.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    delay(timeoutMs),
  ]);
}

async function cleanup() {
  if (browser.exitCode === null) browser.kill('SIGTERM');
  await waitForExit(2_000);
  if (browser.exitCode === null) {
    browser.kill('SIGKILL');
    await waitForExit(1_000);
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 11) {
        console.warn(`Could not remove temporary Chrome profile: ${error.message}`);
        return;
      }
      await delay(100);
    }
  }
}

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

try {
  const target = await waitForTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out opening CDP WebSocket')), 10_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('CDP WebSocket failed'));
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
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
    else entry.resolve(message.result ?? {});
  });

  const command = (method, params = {}, timeoutMs = 20_000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for CDP command ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer, method });
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
  await command('Page.enable');

  const deviceExpression = `document.querySelector('ee-hardware-wallet[data-reference-device]')`;

  const screen = async () => evaluate(`(() => {
    const device = ${deviceExpression};
    return {
      title: device?.getAttribute('screen-title') ?? null,
      line1: device?.getAttribute('screen-line-1') ?? null,
      state: device?.getAttribute('state') ?? null,
      pressed: device?.getAttribute('pressed') ?? null,
      frame: document.querySelector('[data-frame-state]')?.textContent ?? null,
      power: document.querySelector('[data-power-state]')?.textContent ?? null,
      circuit: document.querySelector('[data-wallet-circuit]')?.getAttribute('src') ?? null,
    };
  })()`);

  const sequenceFrom = (frameText) => {
    const match = /seq\s+(\d+)/i.exec(frameText ?? '');
    return match ? Number(match[1]) : null;
  };

  const waitFor = async (predicate, label, timeoutMs = 35_000) => {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      last = await screen();
      if (last.title === 'EMULATOR ERROR') {
        throw new Error(`Wallet twin failed closed in Chrome: ${JSON.stringify(last)}`);
      }
      if (predicate(last)) return last;
      await delay(25);
    }
    throw new Error(`Timed out waiting for ${label}; last view was ${JSON.stringify(last)}`);
  };

  const waitForTitle = (title, timeoutMs) => waitFor(
    (view) => view.title === title,
    `screen title ${title}`,
    timeoutMs,
  );

  const waitForState = (state, timeoutMs) => waitFor(
    (view) => view.state === state,
    `device state ${state}`,
    timeoutMs,
  );

  const clickAndWait = async (selector, label = selector) => {
    const before = await screen();
    const beforeSequence = sequenceFrom(before.frame);
    const clicked = await evaluate(`(() => {
      const control = document.querySelector(${JSON.stringify(selector)});
      if (!(control instanceof HTMLElement)) return false;
      control.click();
      return true;
    })()`);
    if (!clicked) throw new Error(`Could not click ${label}`);
    return waitFor(
      (view) => {
        const sequence = sequenceFrom(view.frame);
        return sequence !== null && beforeSequence !== null && sequence !== beforeSequence;
      },
      `${label} firmware transition`,
    );
  };

  await waitForTitle('TWO-BUTTON WALLET OS');

  const structure = await evaluate(`(() => {
    const devices = [...document.querySelectorAll('ee-hardware-wallet[data-reference-device]')];
    const assembly = document.querySelector('.device-lab--assembled');
    const heading = [...document.querySelectorAll('h2')].find((node) => node.textContent?.trim() === 'The assembled device');
    return {
      deviceCount: devices.length,
      hasCircuit: Boolean(assembly?.querySelector('[data-wallet-circuit]')),
      afterHeading: Boolean(heading && assembly && (heading.compareDocumentPosition(assembly) & Node.DOCUMENT_POSITION_FOLLOWING)),
      oldEngineeringStack: Boolean(document.querySelector('.engineering-stack')),
      controls: assembly?.querySelectorAll('.wallet-inputs button').length ?? 0,
    };
  })()`);
  if (structure.deviceCount !== 1 || !structure.hasCircuit || !structure.afterHeading || structure.oldEngineeringStack || structure.controls < 5) {
    throw new Error(`The final article assembly is structurally wrong: ${JSON.stringify(structure)}`);
  }

  const observerInstalled = await evaluate(`(() => {
    const device = ${deviceExpression};
    const iframe = document.querySelector('[data-wallet-circuit]');
    if (!device || !iframe) return false;
    const proof = window.__walletOsProof = { frames: [], circuits: [], pressed: [], power: [] };
    const record = () => {
      const frame = {
        title: device.getAttribute('screen-title') ?? '',
        line1: device.getAttribute('screen-line-1') ?? '',
        state: device.getAttribute('state') ?? '',
      };
      const previous = proof.frames.at(-1);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(frame)) proof.frames.push(frame);
      const pressed = device.getAttribute('pressed') ?? 'none';
      if (proof.pressed.at(-1) !== pressed) proof.pressed.push(pressed);
      const power = document.querySelector('[data-power-state]')?.textContent ?? '';
      if (proof.power.at(-1) !== power) proof.power.push(power);
    };
    const recordCircuit = () => {
      const src = iframe.getAttribute('src') ?? '';
      if (proof.circuits.at(-1) !== src) proof.circuits.push(src);
    };
    new MutationObserver(record).observe(device, { attributes: true });
    new MutationObserver(record).observe(document.querySelector('[data-power-state]'), { childList: true, subtree: true });
    new MutationObserver(recordCircuit).observe(iframe, { attributes: true, attributeFilter: ['src'] });
    record();
    recordCircuit();
    return true;
  })()`);
  if (!observerInstalled) throw new Error('Could not install wallet OS proof observers');

  const enter = '[data-wallet-enter]';
  const left = '[data-wallet-left]';
  const right = '[data-wallet-right]';

  await clickAndWait(enter, 'both buttons: begin');
  await waitForTitle('INITIALIZATION');
  await clickAndWait(enter, 'both buttons: set up new device');
  await waitForTitle('CREATE PIN');

  for (let digit = 0; digit < 4; digit += 1) {
    await clickAndWait(enter, `create PIN digit ${digit + 1}`);
  }
  await waitForTitle('CONFIRM PIN');
  for (let digit = 0; digit < 4; digit += 1) {
    await clickAndWait(enter, `confirm PIN digit ${digit + 1}`);
  }
  await waitForTitle('RECOVERY BACKUP');
  await clickAndWait(enter, 'show recovery phrase');
  await waitForTitle('RECOVERY WORD 01 / 24');

  for (let word = 2; word <= 24; word += 1) {
    await clickAndWait(right, `recovery word ${word}`);
  }
  const word24 = await waitForTitle('RECOVERY WORD 24 / 24');
  if (word24.line1 !== 'BLESS') {
    throw new Error(`Browser did not render recovery word 24 from firmware: ${JSON.stringify(word24)}`);
  }

  await clickAndWait(enter, 'start recovery verification');
  await waitForTitle('VERIFY WORD #03');
  await clickAndWait(right, 'word 3 candidate 2');
  await clickAndWait(right, 'word 3 candidate 3');
  await clickAndWait(enter, 'verify word 3');
  await waitForTitle('VERIFY WORD #24');
  await clickAndWait(right, 'word 24 candidate 2');
  await clickAndWait(right, 'word 24 candidate 3');
  await clickAndWait(enter, 'verify word 24');
  await waitForTitle('DEVICE IS READY');
  await clickAndWait(enter, 'open dashboard');
  await waitForTitle('DASHBOARD');

  // Open Settings -> Power -> Sleep now.
  await clickAndWait(right, 'select Settings');
  let current = await screen();
  if (current.line1 !== 'SETTINGS') throw new Error(`Settings was not selected: ${JSON.stringify(current)}`);
  await clickAndWait(enter, 'open Settings');
  await waitForTitle('SETTINGS');
  await clickAndWait(right, 'select Display');
  await clickAndWait(right, 'select Power');
  current = await screen();
  if (current.line1 !== 'POWER') throw new Error(`Power was not selected: ${JSON.stringify(current)}`);
  await clickAndWait(enter, 'open Power');
  await waitForTitle('POWER');
  await clickAndWait(enter, 'enter WFI sleep');
  const sleeping = await waitForState('sleeping');
  await waitFor(
    (view) => view.power?.includes('WFI'),
    'Firmverse WFI telemetry',
  );
  if (!sleeping.circuit?.includes('awake=0') || !sleeping.circuit.includes('display=0')) {
    throw new Error(`NodeSpice did not switch to the WFI circuit: ${JSON.stringify(sleeping)}`);
  }

  // A physical P14 edge wakes the CPU, but the wallet returns locked.
  await clickAndWait(left, 'P14 wake edge');
  const locked = await waitForTitle('DEVICE LOCKED');
  await waitFor(
    (view) => view.power?.includes('wakes 1') && view.power.includes('last P14'),
    'GPIO wake evidence',
  );
  if (locked.state !== 'locked' || !locked.circuit?.includes('awake=1')) {
    throw new Error(`Wake did not return to a powered locked device: ${JSON.stringify(locked)}`);
  }

  await clickAndWait(enter, 'open PIN unlock');
  await waitForTitle('ENTER PIN');
  for (let digit = 0; digit < 4; digit += 1) {
    await clickAndWait(enter, `unlock PIN digit ${digit + 1}`);
  }
  await waitForTitle('DASHBOARD');

  // Dashboard starts on Bitcoin after a successful unlock.
  await clickAndWait(enter, 'open Bitcoin app');
  await waitForTitle('BITCOIN');
  await clickAndWait(enter, 'open transaction review');
  await waitForTitle('REVIEW TRANSACTION');
  await clickAndWait(right, 'review amount');
  await clickAndWait(right, 'review recipient');
  await clickAndWait(right, 'select Approve');
  const approve = await waitForTitle('APPROVE');
  if (approve.state !== 'review') {
    throw new Error(`Right-button navigation crossed the approval boundary: ${JSON.stringify(approve)}`);
  }

  await clickAndWait(enter, 'P14+P16 approval chord');
  await waitForTitle('APPROVED');
  await waitForTitle('SIGNATURE READY', 45_000);

  const proof = await evaluate(`window.__walletOsProof`);
  const titles = proof.frames.map((frame) => frame.title || 'DISPLAY OFF');
  for (const required of [
    'TWO-BUTTON WALLET OS',
    'CREATE PIN',
    'RECOVERY WORD 24 / 24',
    'DEVICE IS READY',
    'DASHBOARD',
    'POWER',
    'DISPLAY OFF',
    'DEVICE LOCKED',
    'ENTER PIN',
    'REVIEW TRANSACTION',
    'APPROVE',
    'APPROVED',
    'SIGNATURE READY',
  ]) {
    if (!titles.includes(required)) {
      throw new Error(`Browser proof missed ${required}: ${titles.join(' -> ')}`);
    }
  }
  if (!proof.pressed.includes('both')) {
    throw new Error(`The physical twin never visualized a simultaneous press: ${proof.pressed.join(' -> ')}`);
  }
  if (!proof.circuits.some((src) => src.includes('awake=0') && src.includes('display=0'))) {
    throw new Error(`NodeSpice never observed the WFI branch: ${proof.circuits.join(' | ')}`);
  }
  if (!proof.circuits.some((src) => src.includes('awake=1') && src.includes('signing=1'))) {
    throw new Error(`NodeSpice never observed the signing branch: ${proof.circuits.join(' | ')}`);
  }

  const evidence = await evaluate(`(() => ({
    domain: document.querySelector('[data-domain-state]')?.textContent ?? '',
    frame: document.querySelector('[data-frame-state]')?.textContent ?? '',
    gpio: document.querySelector('[data-gpio-state]')?.textContent ?? '',
    power: document.querySelector('[data-power-state]')?.textContent ?? '',
    circuit: document.querySelector('[data-circuit-state]')?.textContent ?? '',
    provenance: document.querySelector('[data-provenance-state]')?.textContent ?? '',
  }))()`);
  if (!evidence.domain.includes('signed') || !evidence.provenance.includes('e8d23c')) {
    throw new Error(`Evidence rail is stale: ${JSON.stringify(evidence)}`);
  }

  console.log([
    `Article assembly: one final device + integrated NodeSpice circuit`,
    `Onboarding: PIN + 24 words + backup verification completed in Chrome`,
    `Power: WFI circuit observed, P14 woke to locked state, PIN restored dashboard`,
    `Authorization: right navigated; simultaneous P14+P16 produced signing`,
    `Frames observed: ${titles.join(' -> ')}`,
    `Evidence: ${evidence.domain}; ${evidence.power}; ${evidence.provenance}`,
  ].join('\n'));

  socket.close();
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  if (chromeStderr) console.error(`--- Chrome stderr ---\n${chromeStderr}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
