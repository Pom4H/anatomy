import { registerElectricalElements } from '@pom4h/electrical-elements/register';

registerElectricalElements();

type Gesture = 'left' | 'right' | 'both';
type ElementState = 'setup' | 'menu' | 'locked' | 'review' | 'approved' | 'rejected' | 'signed' | 'sleeping' | 'warning';

interface WalletFrame {
  readonly version: number;
  readonly state: number;
  readonly flags: number;
  readonly sequence: number;
  readonly title: string;
  readonly line1: string;
  readonly line2: string;
  readonly footer: string;
  readonly left: string;
  readonly right: string;
  readonly wakeCount: number;
}

interface FirmversePower {
  readonly sleeping?: boolean;
  readonly sleepEntries?: number;
  readonly wakeCount?: number;
  readonly lastWakePin?: number | null;
}

interface FirmverseNode {
  readonly id: string;
  readonly frames?: readonly string[];
  readonly stopped?: string | null;
  readonly insns?: number;
  readonly power?: FirmversePower;
  readonly gpio?: { readonly dr?: number; readonly ddr?: number };
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

const PIN_LEFT_MASK = 1 << 8;
const PIN_RIGHT_MASK = 1 << 10;
const PIN_BOTH_MASK = PIN_LEFT_MASK | PIN_RIGHT_MASK;
const DISPLAY_FLAG = 1 << 3;
const SLEEP_FLAG = 1 << 4;
const SETUP_COMPLETE_FLAG = 1 << 5;
const SIGNING_FLAG = 1;

const stateNames = [
  'welcome',
  'setup choice',
  'create PIN',
  'confirm PIN',
  'PIN mismatch',
  'recovery introduction',
  'recovery word',
  'recovery check',
  'backup check failed',
  'setup complete',
  'dashboard',
  'Bitcoin app',
  'settings',
  'security settings',
  'display settings',
  'power settings',
  'about',
  'information',
  'control center',
  'locked',
  'PIN unlock',
  'wrong PIN',
  'transaction review',
  'signing',
  'signed',
  'rejected',
  'sleeping',
  'error',
] as const;

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
  let cursor = 8;
  while (cursor <= bytes.length && fields.length < 6) {
    if (cursor === bytes.length || bytes[cursor] === 0) {
      fields.push(decoder.decode(bytes.slice(start, cursor)));
      start = cursor + 1;
    }
    cursor += 1;
  }

  return {
    version: bytes[4] ?? 0,
    state: bytes[5] ?? 27,
    flags: bytes[6] ?? 0,
    sequence: bytes[7] ?? 0,
    title: fields[0] ?? 'FIRMWARE FRAME',
    line1: fields[1] ?? '',
    line2: fields[2] ?? '',
    footer: fields[3] ?? '',
    left: fields[4] ?? '',
    right: fields[5] ?? '',
    wakeCount: start < bytes.length ? (bytes[start] ?? 0) : 0,
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
  if (frame.state <= 8) return frame.state === 4 || frame.state === 8 ? 'warning' : 'setup';
  if (frame.state === 9) return 'approved';
  if (frame.state >= 10 && frame.state <= 18) return 'menu';
  if (frame.state === 19 || frame.state === 20) return 'locked';
  if (frame.state === 21 || frame.state === 27) return 'warning';
  if (frame.state === 22) return 'review';
  if (frame.state === 23) return 'approved';
  if (frame.state === 24) return 'signed';
  if (frame.state === 25) return 'rejected';
  if (frame.state === 26) return 'sleeping';
  return 'warning';
}

function stateExplanation(frame: WalletFrame): string {
  switch (frame.state) {
    case 0: return 'Factory state. Press both buttons to begin initialization.';
    case 1: return 'Choose New device with both buttons. Left and right switch between new and restore.';
    case 2: return 'Create a four-digit PIN: left/right choose a digit; both buttons enter it. The reproducible lesson accepts 0000.';
    case 3: return 'Enter the same PIN again. Setup continues only if both entries match.';
    case 5: return 'The device is ready to reveal its 24-word offline recovery backup.';
    case 6: return 'Copy the current recovery word. Right advances; left goes back. On word 24, both buttons continue.';
    case 7: return 'Verify the written backup. The correct demo candidate is the third option: press Right twice, then both buttons.';
    case 9: return 'PIN and recovery backup are verified. Both buttons open the dashboard.';
    case 10: return 'Dashboard. Left/right browse Bitcoin, Settings, and About; both buttons open the selected item.';
    case 11: return 'Bitcoin app. Both buttons open a real reducer-backed transaction review.';
    case 12: return 'Settings. Browse Security, Display, Power, and Back with left/right; both buttons enter.';
    case 15: return 'Power settings. Sleep now is the first item; both buttons lock the wallet and execute Cortex-M WFI.';
    case 18: return 'Control center opened by holding both buttons. It contains Lock, Settings, Sleep, and Close.';
    case 19: return 'The CPU is awake, but the wallet session is locked. Both buttons start PIN entry.';
    case 20: return 'Enter the PIN with the same left/right/both grammar. The demo PIN is whatever you created.';
    case 22: return 'Review pages are navigation only. Move to APPROVE or REJECT; both buttons make the explicit decision.';
    case 23: return 'OperationConfirmed produced ExecuteOperation. Input is locked while signing runs.';
    case 24: return 'The signature is complete. The private key remained inside the wallet boundary.';
    case 25: return 'UserRejected completed without emitting a private-key execution effect.';
    case 26: return 'The display is off and the guest Cortex-M is in WFI. Any rising P14/P16 edge wakes it to the locked screen.';
    default: return 'The firmware stopped at a fail-closed state. No signature was authorized.';
  }
}

function stateHint(frame: WalletFrame): string {
  switch (frame.state) {
    case 0: return 'Both buttons · Enter';
    case 2:
    case 3:
    case 20: return 'Left/right digit · both buttons accept';
    case 6: return frame.title.includes('24 / 24') ? 'Both buttons continue' : 'Right = next recovery word';
    case 7: return 'Right ×2 · both buttons select the third candidate';
    case 10: return 'Right once selects Settings · both buttons enter';
    case 12: return 'Right twice selects Power · both buttons enter';
    case 15: return 'Both buttons enter WFI sleep';
    case 19: return 'Both buttons open PIN entry';
    case 22: return 'Right until APPROVE · both buttons authorize';
    case 26: return 'Press Left or Right to generate a GPIO wake edge';
    default: return 'Left/right navigate · both buttons enter';
  }
}

function setText(lab: HTMLElement, selector: string, value: string): void {
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
  setText(lab, '[data-device-status]', message);
  setText(lab, '[data-power-state]', 'runtime error');
}

function synchronizeCircuit(
  lab: HTMLElement,
  frame: WalletFrame,
  power: FirmversePower | undefined,
): void {
  const iframe = lab.querySelector<HTMLIFrameElement>('[data-wallet-circuit]');
  if (!iframe) return;

  const sleeping = power?.sleeping ?? ((frame.flags & SLEEP_FLAG) !== 0);
  const displayEnabled = (frame.flags & DISPLAY_FLAG) !== 0 && !sleeping;
  const signingActive = (frame.flags & SIGNING_FLAG) !== 0 && !sleeping;
  const signature = `${Number(!sleeping)}:${Number(displayEnabled)}:${Number(signingActive)}`;
  if (iframe.dataset.firmwareLoads !== signature) {
    const url = new URL(iframe.src, window.location.href);
    url.searchParams.set('example', 'hardware-wallet-power');
    url.searchParams.set('embed', '1');
    url.searchParams.set('view', 'schematic');
    url.searchParams.set('awake', sleeping ? '0' : '1');
    url.searchParams.set('display', displayEnabled ? '1' : '0');
    url.searchParams.set('signing', signingActive ? '1' : '0');
    iframe.dataset.firmwareLoads = signature;
    iframe.src = url.toString();
  }

  const mode = sleeping
    ? 'WFI · DISPLAY OFF'
    : signingActive
      ? 'ACTIVE · DISPLAY + SIGNING'
      : displayEnabled
        ? 'ACTIVE · DISPLAY ON'
        : 'ACTIVE · DISPLAY OFF';
  setText(lab, '[data-circuit-mode]', mode);
  setText(lab, '[data-circuit-state]', sleeping ? '33 kΩ WFI branch' : signingActive ? 'active + signing branches' : '73.3 Ω active branch');
}

async function bindLiveTwin(device: HTMLElement): Promise<void> {
  const lab = device.closest<HTMLElement>('[data-device-lab]');
  if (!lab || device.dataset.bound === 'true') return;

  const root = device.shadowRoot;
  const physicalLeft = root?.querySelector<SVGGElement>('[data-part="button-left"]');
  const physicalRight = root?.querySelector<SVGGElement>('[data-part="button-right"]');
  if (!physicalLeft || !physicalRight) {
    window.requestAnimationFrame(() => void bindLiveTwin(device));
    return;
  }

  device.dataset.bound = 'true';
  device.setAttribute('connected', '');

  const leftControl = lab.querySelector<HTMLButtonElement>('[data-wallet-left]');
  const rightControl = lab.querySelector<HTMLButtonElement>('[data-wallet-right]');
  const enterControl = lab.querySelector<HTMLButtonElement>('[data-wallet-enter]');
  const controlCenter = lab.querySelector<HTMLButtonElement>('[data-wallet-control]');
  const resetControl = lab.querySelector<HTMLButtonElement>('[data-wallet-reset]');

  let worker: Worker | null = null;
  let ready = false;
  let running = false;
  let latestSequence = -1;
  let currentFrame: WalletFrame | null = null;
  let inputMask = 0;
  let generation = 0;

  const postRun = (): void => {
    if (worker && ready && !running) worker.postMessage({ type: 'run' });
  };

  const applyInputMask = (mask: number): void => {
    inputMask = mask >>> 0;
    worker?.postMessage({ type: 'inputs', id: 'wallet', mask: inputMask });
    const labels: string[] = [];
    if ((inputMask & PIN_LEFT_MASK) !== 0) labels.push('P14');
    if ((inputMask & PIN_RIGHT_MASK) !== 0) labels.push('P16');
    setText(lab, '[data-gpio-state]', labels.length ? `${labels.join(' + ')} high` : 'GPIO chord released');
    postRun();
  };

  const gestureMask = (gesture: Gesture): number => {
    if (gesture === 'left') return PIN_LEFT_MASK;
    if (gesture === 'right') return PIN_RIGHT_MASK;
    return PIN_BOTH_MASK;
  };

  const press = (gesture: Gesture, holdMs = 110): void => {
    if (!ready || inputMask !== 0) return;
    device.setAttribute('pressed', gesture);
    applyInputMask(gestureMask(gesture));
    window.setTimeout(() => {
      applyInputMask(0);
      device.setAttribute('pressed', 'none');
    }, holdMs);
  };

  const renderSnapshot = (snapshot: FirmverseSnapshot): void => {
    const node = snapshot.nodes?.find((candidate) => candidate.id === 'wallet');
    if (!node) return;
    if (node.stopped) {
      renderFailure(device, lab, `Firmware stopped: ${node.stopped}`);
      return;
    }

    const frame = latestWalletFrame(snapshot);
    if (frame) currentFrame = frame;
    if (!currentFrame) return;

    if (currentFrame.sequence !== latestSequence) {
      latestSequence = currentFrame.sequence;
      device.setAttribute('state', elementState(currentFrame));
      device.setAttribute('screen-title', currentFrame.title);
      device.setAttribute('screen-line-1', currentFrame.line1);
      device.setAttribute('screen-line-2', currentFrame.line2);
      device.setAttribute('screen-footer', currentFrame.footer);
      device.setAttribute('left-label', currentFrame.left || '—');
      device.setAttribute('right-label', currentFrame.right || '—');
      setText(lab, '[data-device-status]', stateExplanation(currentFrame));
      const hint = lab.querySelector<HTMLElement>('[data-wallet-hint]');
      if (hint) hint.innerHTML = `<strong>Next useful gesture</strong>${stateHint(currentFrame)}`;
    }

    const name = stateNames[currentFrame.state] ?? `state ${currentFrame.state}`;
    const setup = (currentFrame.flags & SETUP_COMPLETE_FLAG) !== 0 ? 'setup complete' : 'factory state';
    setText(lab, '[data-domain-state]', `${name} · ${setup}`);
    setText(lab, '[data-frame-state]', `v${currentFrame.version} · seq ${currentFrame.sequence} · wake ${currentFrame.wakeCount}`);

    const power = node.power;
    const sleeping = power?.sleeping ?? ((currentFrame.flags & SLEEP_FLAG) !== 0);
    const wakePin = power?.lastWakePin === null || power?.lastWakePin === undefined
      ? 'none'
      : power.lastWakePin === 8
        ? 'P14'
        : power.lastWakePin === 10
          ? 'P16'
          : `GPIO ${power.lastWakePin}`;
    setText(
      lab,
      '[data-power-state]',
      sleeping
        ? `WFI · entries ${power?.sleepEntries ?? 0}`
        : `running · wakes ${power?.wakeCount ?? 0} · last ${wakePin}`,
    );
    setText(lab, '[data-provenance-state]', 'HW e8d23c · FV atomic GPIO · EL 7b7af1 · NS power-state');
    synchronizeCircuit(lab, currentFrame, power);
  };

  const startRuntime = (): void => {
    generation += 1;
    const thisGeneration = generation;
    worker?.terminate();
    worker = new Worker(workerUrl, { type: 'module', name: `hardware-wallet-firmverse-${generation}` });
    ready = false;
    running = false;
    latestSequence = -1;
    currentFrame = null;
    inputMask = 0;
    device.setAttribute('state', 'setup');
    device.setAttribute('screen-title', 'BOOTING WALLET OS');
    device.setAttribute('screen-line-1', 'FIRMVERSE');
    device.setAttribute('screen-line-2', 'LOADING CORTEX-M');
    device.setAttribute('screen-footer', 'WAIT FOR FIRMWARE FRAME');
    device.setAttribute('left-label', 'LEFT');
    device.setAttribute('right-label', 'RIGHT');
    device.setAttribute('pressed', 'none');
    setText(lab, '[data-device-status]', 'Firmverse is loading the wallet firmware.');
    setText(lab, '[data-domain-state]', 'booting');
    setText(lab, '[data-frame-state]', 'waiting');
    setText(lab, '[data-gpio-state]', 'waiting');
    setText(lab, '[data-power-state]', 'starting');

    worker.onmessage = async (event: MessageEvent<WorkerMessage>) => {
      if (thisGeneration !== generation || !worker) return;
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
            label: 'two-button-wallet-os',
            firmware,
            x: 0,
            y: 0,
          });
          ready = true;
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
        renderSnapshot(message.snapshot);
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

    worker.postMessage({
      type: 'init',
      wasm: wasmUrl.toString(),
      world: 'mesh',
      looping: true,
      strict: true,
      maxInsns: 2_000_000_000,
    });
  };

  const bindSingleButton = (button: SVGGElement, gesture: 'left' | 'right'): void => {
    button.addEventListener('click', () => press(gesture));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      press(gesture);
    });
  };

  bindSingleButton(physicalLeft, 'left');
  bindSingleButton(physicalRight, 'right');
  leftControl?.addEventListener('click', () => press('left'));
  rightControl?.addEventListener('click', () => press('right'));
  enterControl?.addEventListener('click', () => press('both'));
  controlCenter?.addEventListener('click', () => press('both', 1_700));
  resetControl?.addEventListener('click', startRuntime);

  lab.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      press('left');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      press('right');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      press('both');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!worker) return;
    if (document.hidden) {
      worker.postMessage({ type: 'stop' });
      running = false;
    } else {
      postRun();
    }
  });

  startRuntime();
}

customElements.whenDefined('ee-hardware-wallet').then(() => {
  document
    .querySelectorAll<HTMLElement>('ee-hardware-wallet[data-reference-device]')
    .forEach((device) => void bindLiveTwin(device));
});
