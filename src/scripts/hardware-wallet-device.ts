import { registerElectricalElements } from '@pom4h/electrical-elements/register';

registerElectricalElements();

type Side = 'left' | 'right';
type ElementState = 'locked' | 'review' | 'approved' | 'rejected' | 'signed' | 'warning';

interface WalletFrame {
  readonly state: number;
  readonly flags: number;
  readonly sequence: number;
  readonly title: string;
  readonly line1: string;
  readonly line2: string;
  readonly footer: string;
  readonly left: string;
  readonly right: string;
}

interface FirmverseNode {
  readonly id: string;
  readonly frames?: readonly string[];
  readonly stopped?: string | null;
  readonly insns?: number;
}

interface FirmverseSnapshot {
  readonly world?: { readonly nowMs?: number };
  readonly nodes?: readonly FirmverseNode[];
}

interface WorkerMessage {
  readonly type?: string;
  readonly running?: boolean;
  readonly error?: string;
  readonly snapshot?: FirmverseSnapshot;
}

const base = import.meta.env.BASE_URL;
const workerUrl = new URL(`${base}labs/wallet-twin/engine-worker.js`, window.location.origin);
const wasmUrl = new URL(`${base}labs/wallet-twin/firmverse.wasm`, window.location.origin);
const firmwareUrl = new URL(`${base}labs/wallet-twin/wallet-demo.hex`, window.location.origin);
const decoder = new TextDecoder('ascii');

function bytesFromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Firmverse returned an odd-length frame');
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const value = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (!Number.isFinite(value)) throw new Error('Firmverse returned a non-hex frame');
    bytes[index] = value;
  }
  return bytes;
}

function parseWalletFrame(hex: string): WalletFrame | null {
  if (!hex.startsWith('574C5431')) return null;
  const bytes = bytesFromHex(hex);
  if (bytes.length < 8 || decoder.decode(bytes.slice(0, 4)) !== 'WLT1') return null;

  const fields: string[] = [];
  let start = 8;
  for (let index = 8; index <= bytes.length && fields.length < 6; index += 1) {
    if (index !== bytes.length && bytes[index] !== 0) continue;
    fields.push(decoder.decode(bytes.slice(start, index)));
    start = index + 1;
  }

  return {
    state: bytes[5] ?? 6,
    flags: bytes[6] ?? 0,
    sequence: bytes[7] ?? 0,
    title: fields[0] ?? 'FIRMWARE FRAME',
    line1: fields[1] ?? '',
    line2: fields[2] ?? '',
    footer: fields[3] ?? '',
    left: fields[4] ?? '',
    right: fields[5] ?? '',
  };
}

function latestWalletFrame(snapshot: FirmverseSnapshot): WalletFrame | null {
  const node = snapshot.nodes?.find((candidate) => candidate.id === 'wallet');
  for (const hex of [...(node?.frames ?? [])].reverse()) {
    const frame = parseWalletFrame(hex);
    if (frame) return frame;
  }
  return null;
}

function elementState(frame: WalletFrame): ElementState {
  switch (frame.state) {
    case 0: return 'locked';
    case 1: return 'approved';
    case 2: return 'review';
    case 3: return 'approved';
    case 4: return 'signed';
    case 5: return 'rejected';
    default: return 'warning';
  }
}

function stateExplanation(frame: WalletFrame): string {
  switch (frame.state) {
    case 0:
      return 'The Cortex-M firmware is provisioned and locked. The right physical button starts the real wallet-core unlock flow.';
    case 1:
      return 'The reducer opened a host-bound wallet session. Press right to ask the firmware to prepare a transaction review, or left to lock.';
    case 2:
      return 'The reducer is waiting in its device-owned review stage. P14 rejects; P16 confirms the exact operation displayed by firmware.';
    case 3:
      return 'Physical confirmation produced ExecuteOperation. Firmware is now advancing the isolated signing stage; both buttons are ignored.';
    case 4:
      return 'OperationCompleted returned the reducer to Idle. The signature may leave the device; the private key did not.';
    case 5:
      return 'OperationRejected produced UserRejected. No private-key execution effect was emitted.';
    default:
      return 'The firmware failed closed. No signature was authorized.';
  }
}

function ensureEvidencePanel(lab: HTMLElement): void {
  if (lab.querySelector('[data-wallet-evidence]')) return;
  const panel = document.createElement('div');
  panel.className = 'device-lab__evidence';
  panel.dataset.walletEvidence = 'true';
  panel.innerHTML = `
    <div><small>Domain</small><strong>wallet-core reducer</strong><span data-domain-state>booting</span></div>
    <div><small>Firmware</small><strong>Cortex-M0 · Intel HEX</strong><span data-firmware-state>loading</span></div>
    <div><small>Emulator</small><strong>Firmverse · Rust/WASM</strong><span data-emulator-state>initializing</span></div>
    <div><small>Physical I/O</small><strong>P14 / P16 GPIO</strong><span data-gpio-state>waiting</span></div>
    <div><small>Power model</small><strong>NodeSpice · Rust/WASM</strong><span data-circuit-state>display load</span></div>
  `;
  lab.querySelector('.device-lab__surface')?.insertAdjacentElement('afterend', panel);
}

function setEvidence(lab: HTMLElement, selector: string, value: string): void {
  const target = lab.querySelector<HTMLElement>(selector);
  if (target) target.textContent = value;
}

function renderFailure(device: HTMLElement, lab: HTMLElement, message: string): void {
  device.setAttribute('state', 'warning');
  device.setAttribute('screen-title', 'EMULATOR ERROR');
  device.setAttribute('screen-line-1', 'FAIL CLOSED');
  device.setAttribute('screen-line-2', 'NOTHING SIGNED');
  device.setAttribute('screen-footer', message.slice(0, 42).toUpperCase());
  device.setAttribute('left-label', '—');
  device.setAttribute('right-label', '—');
  const status = lab.querySelector<HTMLElement>('[data-device-status]');
  if (status) status.textContent = message;
  setEvidence(lab, '[data-emulator-state]', 'error');
}

function synchronizeCircuit(lab: HTMLElement, frame: WalletFrame): void {
  const iframe = document.querySelector<HTMLIFrameElement>('.circuit-lab iframe');
  if (!iframe) return;
  const displayEnabled = (frame.flags & (1 << 3)) !== 0;
  const signingActive = (frame.flags & 1) !== 0;
  const signature = `${Number(displayEnabled)}:${Number(signingActive)}`;
  if (iframe.dataset.firmwareLoads === signature) return;

  const url = new URL(iframe.src, window.location.href);
  url.searchParams.set('example', 'hardware-wallet-power');
  url.searchParams.set('embed', '1');
  url.searchParams.set('view', 'schematic');
  url.searchParams.set('display', displayEnabled ? '1' : '0');
  url.searchParams.set('signing', signingActive ? '1' : '0');
  iframe.dataset.firmwareLoads = signature;
  iframe.src = url.toString();
  setEvidence(lab, '[data-circuit-state]', signingActive ? 'display + signing load' : 'display load');
}

async function bindLiveTwin(device: HTMLElement): Promise<void> {
  const lab = device.closest<HTMLElement>('[data-device-lab]');
  if (!lab || device.dataset.bound === 'true') return;
  ensureEvidencePanel(lab);

  const root = device.shadowRoot;
  const left = root?.querySelector<SVGGElement>('[data-part="button-left"]');
  const right = root?.querySelector<SVGGElement>('[data-part="button-right"]');
  if (!left || !right) {
    window.requestAnimationFrame(() => void bindLiveTwin(device));
    return;
  }

  device.dataset.bound = 'true';
  device.setAttribute('connected', '');
  device.setAttribute('state', 'locked');
  device.setAttribute('screen-title', 'BOOTING FIRMWARE');
  device.setAttribute('screen-line-1', 'FIRMVERSE WASM');
  device.setAttribute('screen-line-2', 'LOADING CORTEX-M ELF');
  device.setAttribute('screen-footer', 'SOURCE-BACKED DIGITAL TWIN');
  device.setAttribute('left-label', 'WAIT');
  device.setAttribute('right-label', 'WAIT');

  const worker = new Worker(workerUrl, { type: 'module', name: 'hardware-wallet-firmverse' });
  let ready = false;
  let latestSequence = -1;
  let running = false;

  const postRun = (): void => {
    if (ready && !running) worker.postMessage({ type: 'run' });
  };

  const applyFrame = (frame: WalletFrame, snapshot: FirmverseSnapshot): void => {
    if (frame.sequence === latestSequence) return;
    latestSequence = frame.sequence;
    device.setAttribute('state', elementState(frame));
    device.setAttribute('screen-title', frame.title);
    device.setAttribute('screen-line-1', frame.line1);
    device.setAttribute('screen-line-2', frame.line2);
    device.setAttribute('screen-footer', frame.footer);
    device.setAttribute('left-label', frame.left || '—');
    device.setAttribute('right-label', frame.right || '—');

    const status = lab.querySelector<HTMLElement>('[data-device-status]');
    if (status) status.textContent = stateExplanation(frame);
    const node = snapshot.nodes?.find((candidate) => candidate.id === 'wallet');
    setEvidence(lab, '[data-domain-state]', `state ${frame.state} · seq ${frame.sequence}`);
    setEvidence(lab, '[data-firmware-state]', `${frame.title.toLowerCase()} · ${node?.insns?.toLocaleString() ?? '0'} insns`);
    setEvidence(lab, '[data-emulator-state]', `${snapshot.world?.nowMs ?? 0} ms virtual time`);
    setEvidence(lab, '[data-gpio-state]', frame.state === 2 ? 'P14 reject · P16 confirm' : 'firmware owns input meaning');
    synchronizeCircuit(lab, frame);
  };

  worker.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const message = event.data ?? {};
    if (message.type === 'ready') {
      try {
        const response = await fetch(firmwareUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Firmware fetch failed with ${response.status}`);
        const firmware = await response.text();
        worker.postMessage({
          type: 'addNode',
          id: 'wallet',
          board: 'pb03f-kit',
          label: 'hardware-wallet-browser-demo',
          firmware,
          x: 0,
          y: 0,
        });
        ready = true;
        setEvidence(lab, '[data-emulator-state]', 'WASM / zmu ready');
        postRun();
      } catch (error) {
        renderFailure(device, lab, error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (message.type === 'running') {
      running = Boolean(message.running);
      return;
    }
    if (message.type === 'snapshot' && message.snapshot) {
      const stopped = message.snapshot.nodes?.find((node) => node.stopped);
      if (stopped) {
        renderFailure(device, lab, `Firmware stopped: ${stopped.stopped}`);
        return;
      }
      const frame = latestWalletFrame(message.snapshot);
      if (frame) applyFrame(frame, message.snapshot);
      return;
    }
    if (message.type === 'error') {
      running = false;
      renderFailure(device, lab, message.error ?? 'Unknown Firmverse error');
    }
  };

  worker.onerror = (event): void => {
    running = false;
    renderFailure(device, lab, event.message || 'Firmverse worker failed');
  };

  const press = (side: Side): void => {
    if (!ready) return;
    const pin = side === 'left' ? 'P14' : 'P16';
    device.setAttribute('pressed', side);
    setEvidence(lab, '[data-gpio-state]', `${pin} high`);
    worker.postMessage({ type: 'pin', id: 'wallet', pin, high: true });
    postRun();
    window.setTimeout(() => {
      worker.postMessage({ type: 'pin', id: 'wallet', pin, high: false });
      device.setAttribute('pressed', 'none');
      setEvidence(lab, '[data-gpio-state]', `${pin} pulse complete`);
    }, 96);
  };

  const bindButton = (button: SVGGElement, side: Side): void => {
    button.addEventListener('click', () => press(side));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      press(side);
    });
  };

  bindButton(left, 'left');
  bindButton(right, 'right');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      worker.postMessage({ type: 'stop' });
      running = false;
    } else {
      postRun();
    }
  });

  worker.postMessage({
    type: 'init',
    wasm: wasmUrl.toString(),
    world: 'mesh',
    looping: true,
    strict: true,
    maxInsns: 2_000_000_000,
  });
}

customElements.whenDefined('ee-hardware-wallet').then(() => {
  document
    .querySelectorAll<HTMLElement>('ee-hardware-wallet[data-reference-device]')
    .forEach((device) => void bindLiveTwin(device));
});
