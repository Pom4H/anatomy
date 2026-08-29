import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const wasmPath = resolve(root, 'public/labs/wallet-twin/firmverse.wasm');
const firmwarePath = resolve(root, 'public/labs/wallet-twin/wallet-demo.hex');
const sourcesPath = resolve(root, 'public/labs/wallet-twin/sources.json');
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const expectedSources = {
  hardwareWallet: 'd0dfd9652913cb93318e6ae9701ba2718a97bd45',
  firmverse: '17926a8b32ef452824bf3cee10c5eacdba6853d8',
  elements: '7b7af14135a427014875eb217d4e18ddc88bc7cf',
  nodspice: '9a7edda4d8a4c9cb9bb59fb1fe851b94c36576f2',
};

const [{ instance }, firmware, sources] = await Promise.all([
  WebAssembly.instantiate(await readFile(wasmPath), {}),
  readFile(firmwarePath, 'utf8'),
  readFile(sourcesPath, 'utf8').then(JSON.parse),
]);

if (JSON.stringify(sources) !== JSON.stringify(expectedSources)) {
  throw new Error(`Wallet twin revisions are not pinned exactly: ${JSON.stringify(sources)}`);
}

const exports = instance.exports;
for (const name of [
  'memory',
  'firmverse_input_reserve',
  'firmverse_call',
  'firmverse_result_ptr',
  'firmverse_result_len',
]) {
  if (!(name in exports)) throw new Error(`Firmverse WASM is missing export ${name}`);
}

function call(request) {
  const bytes = encoder.encode(JSON.stringify(request));
  const pointer = Number(exports.firmverse_input_reserve(bytes.length));
  new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
  exports.firmverse_call(bytes.length);
  const resultPointer = Number(exports.firmverse_result_ptr());
  const resultLength = Number(exports.firmverse_result_len());
  const raw = decoder.decode(new Uint8Array(exports.memory.buffer, resultPointer, resultLength));
  const result = JSON.parse(raw);
  if (!result.ok) throw new Error(result.error ?? `Firmverse request failed: ${raw}`);
  return result;
}

function latestWalletFrame(snapshot) {
  const node = snapshot?.nodes?.find((candidate) => candidate.id === 'wallet');
  const frameHex = [...(node?.frames ?? [])]
    .reverse()
    .find((candidate) => candidate.startsWith('574C5431'));
  if (!frameHex) return null;

  const bytes = Buffer.from(frameHex, 'hex');
  if (bytes.length < 8 || bytes.subarray(0, 4).toString('ascii') !== 'WLT1') return null;
  const fields = [];
  let start = 8;
  for (let index = 8; index <= bytes.length && fields.length < 6; index += 1) {
    if (index !== bytes.length && bytes[index] !== 0) continue;
    fields.push(bytes.subarray(start, index).toString('ascii'));
    start = index + 1;
  }

  return {
    version: bytes[4],
    state: bytes[5],
    flags: bytes[6],
    sequence: bytes[7],
    title: fields[0] ?? '',
    line1: fields[1] ?? '',
    line2: fields[2] ?? '',
    footer: fields[3] ?? '',
    left: fields[4] ?? '',
    right: fields[5] ?? '',
    wakeCount: start < bytes.length ? bytes[start] : 0,
  };
}

function walletNode(snapshot) {
  const node = snapshot?.nodes?.find((candidate) => candidate.id === 'wallet');
  if (!node) throw new Error('Firmverse snapshot lost the wallet node');
  if (node.stopped) throw new Error(`Wallet firmware stopped: ${node.stopped}`);
  return node;
}

let snapshot = null;

function tick(ticks = 1, burst = 50_000) {
  snapshot = call({ op: 'tick', ticks, burst }).snapshot;
  walletNode(snapshot);
  return snapshot;
}

function setInputs(mask) {
  snapshot = call({ op: 'inputs', id: 'wallet', mask }).snapshot;
  walletNode(snapshot);
  return snapshot;
}

function waitForFrame(predicate, label, { afterSequence = null, limit = 240 } = {}) {
  let last = latestWalletFrame(snapshot);
  for (let attempt = 0; attempt < limit; attempt += 1) {
    if (last && (afterSequence === null || last.sequence !== afterSequence) && predicate(last, snapshot)) {
      return last;
    }
    tick();
    last = latestWalletFrame(snapshot);
  }
  throw new Error(`Timed out waiting for ${label}; last frame was ${JSON.stringify(last)}`);
}

function waitForState(state, title = null, options = {}) {
  return waitForFrame(
    (frame) => frame.state === state && (title === null || frame.title === title),
    title ?? `state ${state}`,
    options,
  );
}

const LEFT = 1 << 8;
const RIGHT = 1 << 10;
const BOTH = LEFT | RIGHT;

function tap(mask, label) {
  const before = latestWalletFrame(snapshot)?.sequence ?? null;
  setInputs(mask);
  tick(2);
  setInputs(0);
  return waitForFrame(
    () => true,
    `${label} frame transition`,
    { afterSequence: before, limit: 120 },
  );
}

function tapExpect(mask, state, title, label = title) {
  const before = latestWalletFrame(snapshot)?.sequence ?? null;
  setInputs(mask);
  tick(2);
  setInputs(0);
  return waitForState(state, title, { afterSequence: before, limit: 160, label });
}

const registry = call({ op: 'registry' }).registry;
if (!registry.boards.some((board) => board.id === 'pb03f-kit' && board.implemented)) {
  throw new Error('Firmverse registry does not expose the implemented PB-03F board');
}

snapshot = call({
  op: 'new',
  world: 'mesh',
  looping: true,
  strict: true,
  maxInsns: 300_000_000,
}).snapshot;
snapshot = call({
  op: 'addNode',
  id: 'wallet',
  board: 'pb03f-kit',
  label: 'two-button-wallet-os',
  firmware,
  x: 0,
  y: 0,
}).snapshot;

const path = [];
const record = (frame) => {
  path.push(`${frame.state}:${frame.title || 'DISPLAY OFF'}`);
  return frame;
};

record(waitForState(0, 'TWO-BUTTON WALLET OS'));
record(tapExpect(BOTH, 1, 'INITIALIZATION', 'open initialization'));
record(tapExpect(BOTH, 2, 'CREATE PIN', 'choose new device'));

for (let digit = 0; digit < 4; digit += 1) tap(BOTH, `create PIN digit ${digit + 1}`);
record(waitForState(3, 'CONFIRM PIN'));
for (let digit = 0; digit < 4; digit += 1) tap(BOTH, `confirm PIN digit ${digit + 1}`);
record(waitForState(5, 'RECOVERY BACKUP'));
record(tapExpect(BOTH, 6, 'RECOVERY WORD 01 / 24', 'show recovery words'));

for (let word = 2; word <= 24; word += 1) {
  tap(RIGHT, `recovery word ${word}`);
}
const word24 = waitForState(6, 'RECOVERY WORD 24 / 24');
if (word24.line1 !== 'BLESS') {
  throw new Error(`Recovery test vector did not reach word 24: ${JSON.stringify(word24)}`);
}
record(word24);
record(tapExpect(BOTH, 7, 'VERIFY WORD #03', 'start recovery verification'));
for (let choice = 0; choice < 2; choice += 1) tap(RIGHT, `word 3 candidate ${choice + 2}`);
record(tapExpect(BOTH, 7, 'VERIFY WORD #24', 'verify word 3'));
for (let choice = 0; choice < 2; choice += 1) tap(RIGHT, `word 24 candidate ${choice + 2}`);
record(tapExpect(BOTH, 9, 'DEVICE IS READY', 'verify word 24'));
record(tapExpect(BOTH, 10, 'DASHBOARD', 'open dashboard'));

// Open Settings -> Power -> Sleep now with the same navigation grammar.
tap(RIGHT, 'select Settings');
const dashboardSettings = waitForState(10, 'DASHBOARD');
if (dashboardSettings.line1 !== 'SETTINGS') {
  throw new Error(`Dashboard did not select Settings: ${JSON.stringify(dashboardSettings)}`);
}
record(tapExpect(BOTH, 12, 'SETTINGS', 'open Settings'));
tap(RIGHT, 'select Display');
tap(RIGHT, 'select Power');
const powerItem = waitForState(12, 'SETTINGS');
if (powerItem.line1 !== 'POWER') {
  throw new Error(`Settings did not select Power: ${JSON.stringify(powerItem)}`);
}
record(tapExpect(BOTH, 15, 'POWER', 'open Power settings'));
const sleepingFrame = tap(BOTH, 'enter WFI sleep');
if (sleepingFrame.state !== 26 || (sleepingFrame.flags & (1 << 4)) === 0) {
  throw new Error(`Firmware did not publish a sleeping frame: ${JSON.stringify(sleepingFrame)}`);
}
record(sleepingFrame);

waitForFrame(
  (_frame, currentSnapshot) => walletNode(currentSnapshot).power?.sleeping === true,
  'Firmverse architectural WFI state',
  { limit: 160 },
);
const sleepingNode = walletNode(snapshot);
const sleepingInsns = sleepingNode.insns;
const sleepEntries = sleepingNode.power?.sleepEntries ?? 0;
if (sleepEntries < 1) throw new Error('Firmverse did not count a WFI entry');
tick(12);
if (walletNode(snapshot).insns !== sleepingInsns) {
  throw new Error('Firmverse advanced Cortex-M instructions while the guest was in WFI');
}

// A P14 rising edge wakes the processor, but the wallet stays locked.
const wakeCountBefore = walletNode(snapshot).power?.wakeCount ?? 0;
const lockedAfterWake = tapExpect(LEFT, 19, 'DEVICE LOCKED', 'wake from P14');
record(lockedAfterWake);
const wakePower = walletNode(snapshot).power;
if (wakePower?.sleeping || wakePower?.wakeCount !== wakeCountBefore + 1 || wakePower?.lastWakePin !== 8) {
  throw new Error(`GPIO wake telemetry is wrong: ${JSON.stringify(wakePower)}`);
}
if ((lockedAfterWake.flags & (1 << 1)) !== 0) {
  throw new Error('GPIO wake incorrectly restored an unlocked wallet session');
}

record(tapExpect(BOTH, 20, 'ENTER PIN', 'open PIN unlock'));
for (let digit = 0; digit < 4; digit += 1) tap(BOTH, `unlock PIN digit ${digit + 1}`);
record(waitForState(10, 'DASHBOARD'));

record(tapExpect(BOTH, 11, 'BITCOIN', 'open Bitcoin app'));
record(tapExpect(BOTH, 22, 'REVIEW TRANSACTION', 'open transaction review'));
for (let page = 0; page < 3; page += 1) tap(RIGHT, `review page ${page + 2}`);
const approve = waitForState(22, 'APPROVE');
if ((approve.flags & 1) !== 0) {
  throw new Error('Right-button navigation started signing before the Enter chord');
}
record(approve);
const signing = tapExpect(BOTH, 23, 'APPROVED', 'approve with both buttons');
if ((signing.flags & 1) === 0) {
  throw new Error('Both-button approval did not expose the signing-active flag');
}
record(signing);
const signed = waitForState(24, 'SIGNATURE READY', { limit: 420 });
if (!signed.line2.includes('PRIVATE KEY')) {
  throw new Error(`Signed frame lost the trusted-boundary explanation: ${JSON.stringify(signed)}`);
}
record(signed);

const [elementSource, nodeSpiceSource, nodeSpiceApp] = await Promise.all([
  readFile(resolve(root, 'vendor/elements/packages/electrical-elements/src/elements/hardware-wallet.ts'), 'utf8'),
  readFile(resolve(root, 'vendor/nodspice/src/domain/examples.ts'), 'utf8'),
  readFile(resolve(root, 'vendor/nodspice/src/main.tsx'), 'utf8'),
]);
if (!elementSource.includes("'both'") || !elementSource.includes("state=\"sleeping\"")) {
  throw new Error('Elements physical twin lacks simultaneous-button or sleeping states');
}
if (!nodeSpiceSource.includes('s-mcu-active') || !nodeSpiceSource.includes('s-mcu-sleep')) {
  throw new Error('NodeSpice lacks mutually exclusive active and WFI MCU branches');
}
if (!nodeSpiceApp.includes("booleanParameter('awake'")) {
  throw new Error('NodeSpice does not expose the firmware-controlled awake parameter');
}

console.log([
  `Firmverse board: pb03f-kit`,
  `Firmware: ${firmware.length} bytes Intel HEX · WLT1 v${signed.version}`,
  `Onboarding: PIN -> 24 words -> two backup checks -> dashboard`,
  `Power: WFI froze at ${sleepingInsns.toLocaleString()} instructions; P14 wake ${wakeCountBefore} -> ${wakePower.wakeCount}`,
  `Authorization: right navigated to APPROVE; P14+P16 chord emitted signing`,
  `Path: ${path.join(' -> ')}`,
].join('\n'));
