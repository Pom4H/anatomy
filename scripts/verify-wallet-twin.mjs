import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const wasmPath = resolve(root, 'public/labs/wallet-twin/firmverse.wasm');
const firmwarePath = resolve(root, 'public/labs/wallet-twin/wallet-demo.hex');
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const [{ instance }, firmware] = await Promise.all([
  WebAssembly.instantiate(await readFile(wasmPath), {}),
  readFile(firmwarePath, 'utf8'),
]);

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
    state: bytes[5],
    flags: bytes[6],
    sequence: bytes[7],
    title: fields[0] ?? '',
    line1: fields[1] ?? '',
    line2: fields[2] ?? '',
    footer: fields[3] ?? '',
    left: fields[4] ?? '',
    right: fields[5] ?? '',
  };
}

function tick(ticks = 1, burst = 50_000) {
  return call({ op: 'tick', ticks, burst }).snapshot;
}

function waitForState(expected, limit = 80) {
  let snapshot;
  for (let attempt = 0; attempt < limit; attempt += 1) {
    snapshot = tick();
    const frame = latestWalletFrame(snapshot);
    if (frame?.state === expected) return frame;
    const stopped = snapshot.nodes?.find((node) => node.stopped);
    if (stopped) throw new Error(`Firmware stopped while waiting for state ${expected}: ${stopped.stopped}`);
  }
  throw new Error(`Firmware did not reach display state ${expected}`);
}

function press(pin, expected) {
  call({ op: 'pin', id: 'wallet', pin, high: true });
  const frame = waitForState(expected);
  call({ op: 'pin', id: 'wallet', pin, high: false });
  tick();
  return frame;
}

const registry = call({ op: 'registry' }).registry;
if (!registry.boards.some((board) => board.id === 'pb03f-kit' && board.implemented)) {
  throw new Error('Firmverse registry does not expose the implemented PB-03F board');
}

call({
  op: 'new',
  world: 'mesh',
  looping: true,
  strict: true,
  maxInsns: 80_000_000,
});
call({
  op: 'addNode',
  id: 'wallet',
  board: 'pb03f-kit',
  label: 'hardware-wallet-browser-demo',
  firmware,
  x: 0,
  y: 0,
});

const locked = waitForState(0);
const ready = press('P16', 1);
const review = press('P16', 2);
const signing = press('P16', 3);
const signed = waitForState(4, 260);

if (review.left !== 'REJECT' || review.right !== 'CONFIRM') {
  throw new Error(`Firmware review buttons are wrong: ${JSON.stringify(review)}`);
}
if ((signing.flags & 1) === 0) throw new Error('Signing frame does not expose the signing-active flag');
if (!signed.line2.includes('PRIVATE KEY')) throw new Error('Signed frame lost the device-owned security explanation');

console.log([
  `Firmverse board: pb03f-kit`,
  `Firmware: ${firmware.length} bytes Intel HEX`,
  `States: ${[locked, ready, review, signing, signed].map((frame) => `${frame.state}:${frame.title}`).join(' -> ')}`,
  `GPIO: P16 drove unlock, review, and confirmation`,
  `Display protocol: WLT1 sequence ${locked.sequence}..${signed.sequence}`,
].join('\n'));
