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

function snapshotState(snapshot) {
  const node = snapshot?.nodes?.find((candidate) => candidate.id === 'wallet');
  const frame = latestWalletFrame(snapshot);
  return {
    frame,
    power: node?.power ?? null,
    gpio: node?.gpio ?? null,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function tickUntil(predicate, description, { limit = 20_000, burst = 2_000 } = {}) {
  for (let attempt = 0; attempt < limit; attempt += 1) {
    const result = call({ op: 'tick', ticks: 1, burst });
    const state = snapshotState(result.snapshot);
    if (predicate(state, result.snapshot)) return { state, snapshot: result.snapshot };
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function press(pin) {
  call({ op: 'pin', id: 'wallet', pin, high: true });
  call({ op: 'tick', ticks: 2, burst: 2_000 });
  call({ op: 'pin', id: 'wallet', pin, high: false });
  call({ op: 'tick', ticks: 2, burst: 2_000 });
}

function chord() {
  call({ op: 'pin', id: 'wallet', pin: 'P14', high: true });
  call({ op: 'pin', id: 'wallet', pin: 'P16', high: true });
  call({ op: 'tick', ticks: 2, burst: 2_000 });
  call({ op: 'pin', id: 'wallet', pin: 'P14', high: false });
  call({ op: 'pin', id: 'wallet', pin: 'P16', high: false });
  call({ op: 'tick', ticks: 2, burst: 2_000 });
}

const initial = call({ op: 'new', world: 'mesh', looping: true, strict: true, maxInsns: 2_000_000_000 });
assert(initial.ok, 'Firmverse failed to initialize');

const added = call({
  op: 'addNode',
  id: 'wallet',
  board: 'pb03f-kit',
  label: 'hardware-wallet-browser-demo',
  firmware,
  x: 0,
  y: 0,
});
assert(added.ok, 'Firmverse failed to add the wallet firmware');

let { state } = tickUntil(
  (candidate) => candidate.frame?.title === 'WELCOME',
  'firmware welcome screen',
);
assert(state.frame?.version === 2, `Expected WLT1 v2 frame, got ${state.frame?.version}`);

chord();
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'SET UP DEVICE',
  'setup choice',
));

chord();
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'CREATE PIN',
  'PIN creation',
));

for (let digit = 0; digit < 4; digit += 1) chord();
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'CONFIRM PIN',
  'PIN confirmation',
));
for (let digit = 0; digit < 4; digit += 1) chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'RECOVERY PHRASE',
  'recovery intro',
));
chord();

for (let word = 1; word < 24; word += 1) press('P16');
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'WORD 24 OF 24',
  'last recovery word',
));
chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'CHECK WORD 3',
  'first recovery check',
));
press('P16');
press('P16');
chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'CHECK WORD 24',
  'second recovery check',
));
press('P16');
press('P16');
chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'SETUP COMPLETE',
  'setup completion',
));
assert((state.frame.flags & (1 << 5)) !== 0, 'Setup-complete flag was not published');
chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'BITCOIN',
  'Bitcoin dashboard item',
));

press('P16');
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'SETTINGS',
  'settings dashboard item',
));
chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'SECURITY',
  'security settings item',
));
press('P16');
press('P16');
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'POWER',
  'power settings item',
));
chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'SLEEP NOW',
  'sleep-now item',
));
chord();

({ state } = tickUntil(
  (candidate) => candidate.power?.sleeping === true,
  'architectural WFI sleep',
));
assert(state.frame?.title === 'SLEEPING', `Expected sleep frame, got ${state.frame?.title}`);
assert(state.power?.sleepEntries >= 1, 'Firmverse did not count the WFI entry');

press('P14');
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'DEVICE LOCKED' && candidate.power?.sleeping === false,
  'GPIO wake to locked screen',
));
assert(state.power?.wakeCount >= 1, 'Firmverse did not count the GPIO wake');
assert(state.power?.lastWakePin === 'P14', `Unexpected wake pin: ${state.power?.lastWakePin}`);

chord();
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'ENTER PIN',
  'PIN unlock screen',
));
for (let digit = 0; digit < 4; digit += 1) chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'BITCOIN',
  'unlocked Bitcoin dashboard item',
));
chord();
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'BITCOIN APP',
  'Bitcoin app',
));
chord();

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'REVIEW TRANSACTION',
  'transaction review intro',
));

press('P16');
press('P16');
press('P16');
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'APPROVE',
  'approve page',
));

press('P16');
call({ op: 'tick', ticks: 4, burst: 2_000 });
({ state } = snapshotState(call({ op: 'snapshot' }).snapshot));
assert(state.frame?.title !== 'SIGNING', 'A single navigation button incorrectly authorized signing');

chord();
({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'SIGNING',
  'authorized signing state',
));
assert((state.frame.flags & 1) !== 0, 'Signing flag was not published');

({ state } = tickUntil(
  (candidate) => candidate.frame?.title === 'SIGNED',
  'signed completion',
));

console.log([
  `Firmverse board: pb03f-kit`,
  `Firmware: ${firmware.length} bytes Intel HEX`,
  `Setup: PIN + 24-word recovery backup + verification completed`,
  `Power: WFI entered ${state.power?.sleepEntries ?? 0} time(s), GPIO wakes ${state.power?.wakeCount ?? 0}`,
  `Authorization: right-button navigation could not sign; P14+P16 chord reached SIGNED`,
  `Display protocol: WLT1 v${state.frame?.version ?? '?'} sequence ${state.frame?.sequence ?? '?'}`,
].join('\n'));
