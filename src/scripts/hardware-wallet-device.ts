import { registerElectricalElements } from '@pom4h/electrical-elements/register';

registerElectricalElements();

type DeviceState = 'locked' | 'review' | 'approved' | 'rejected' | 'signed';
type Side = 'left' | 'right';

interface ScreenCopy {
  readonly title: string;
  readonly line1: string;
  readonly line2: string;
  readonly footer: string;
  readonly left: string;
  readonly right: string;
  readonly status: string;
}

const screens: Record<DeviceState, ScreenCopy> = {
  locked: {
    title: 'DEVICE LOCKED',
    line1: 'RIGHT BUTTON',
    line2: 'OPEN REVIEW',
    footer: 'NO SIGNING SESSION',
    left: 'LOCKED',
    right: 'REVIEW',
    status: 'The reference device is locked. Press the right button to open a transaction review.',
  },
  review: {
    title: 'REVIEW TRANSFER',
    line1: 'SEND 0.10 BTC',
    line2: 'TO BC1Q…7X2',
    footer: 'VERIFY ON DEVICE',
    left: 'REJECT',
    right: 'CONFIRM',
    status: 'The device parsed the request and now owns the trusted review. Reject it with the left button or confirm it with the right button.',
  },
  approved: {
    title: 'APPROVED',
    line1: 'SIGNING',
    line2: 'SECP256K1',
    footer: 'KEY STAYS INSIDE',
    left: 'WAIT',
    right: 'WAIT',
    status: 'Physical approval has been recorded. The isolated runtime is creating a signature without returning the private key.',
  },
  rejected: {
    title: 'REQUEST REJECTED',
    line1: 'NOTHING SIGNED',
    line2: 'HOST GETS ERROR',
    footer: 'PRESS TO RESTART',
    left: 'RESET',
    right: 'RESET',
    status: 'The user rejected the review. No private-key operation was executed.',
  },
  signed: {
    title: 'SIGNATURE READY',
    line1: 'RETURN TO HOST',
    line2: 'NOT THE PRIVATE KEY',
    footer: 'PRESS TO RESTART',
    left: 'RESET',
    right: 'RESET',
    status: 'The device returned a signature to the host. The private key remained inside the signer boundary.',
  },
};

function render(device: HTMLElement, state: DeviceState): void {
  const copy = screens[state];
  device.setAttribute('state', state);
  device.setAttribute('screen-title', copy.title);
  device.setAttribute('screen-line-1', copy.line1);
  device.setAttribute('screen-line-2', copy.line2);
  device.setAttribute('screen-footer', copy.footer);
  device.setAttribute('left-label', copy.left);
  device.setAttribute('right-label', copy.right);
  const status = device.closest('[data-device-lab]')?.querySelector<HTMLElement>('[data-device-status]');
  if (status) status.textContent = copy.status;
}

function bindDevice(device: HTMLElement): void {
  if (device.dataset.bound === 'true') return;
  const root = device.shadowRoot;
  const left = root?.querySelector<SVGGElement>('[data-part="button-left"]');
  const right = root?.querySelector<SVGGElement>('[data-part="button-right"]');
  if (!left || !right) {
    window.requestAnimationFrame(() => bindDevice(device));
    return;
  }

  device.dataset.bound = 'true';
  device.setAttribute('connected', '');
  let completionTimer = 0;

  const activate = (side: Side): void => {
    window.clearTimeout(completionTimer);
    device.setAttribute('pressed', side);
    window.setTimeout(() => device.setAttribute('pressed', 'none'), 130);

    const state = (device.getAttribute('state') ?? 'locked') as DeviceState;
    if (state === 'locked') {
      if (side === 'right') render(device, 'review');
      return;
    }
    if (state === 'review') {
      if (side === 'left') {
        render(device, 'rejected');
        return;
      }
      render(device, 'approved');
      completionTimer = window.setTimeout(() => render(device, 'signed'), 760);
      return;
    }
    if (state === 'approved') return;
    render(device, 'locked');
  };

  const bindButton = (button: SVGGElement, side: Side): void => {
    button.addEventListener('click', () => activate(side));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activate(side);
    });
  };

  bindButton(left, 'left');
  bindButton(right, 'right');
  render(device, 'locked');
}

customElements.whenDefined('ee-hardware-wallet').then(() => {
  document.querySelectorAll<HTMLElement>('ee-hardware-wallet[data-reference-device]').forEach(bindDevice);
});
