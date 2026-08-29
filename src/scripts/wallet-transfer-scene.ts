import { registerElectricalElements } from '@pom4h/electrical-elements/register';

registerElectricalElements();

type Stage =
  | 'verify-receiver'
  | 'review-intro'
  | 'amount'
  | 'recipient'
  | 'approve'
  | 'signing'
  | 'broadcast'
  | 'confirmed'
  | 'complete';

type Gesture = 'left' | 'right' | 'both';

type WalletVisualState = 'menu' | 'review' | 'approved' | 'signed';

interface ScreenCopy {
  readonly state: WalletVisualState;
  readonly title: string;
  readonly line1: string;
  readonly line2: string;
  readonly footer: string;
  readonly left: string;
  readonly right: string;
}

const TXID = '4c8f6d2a…a91d';
const SENDER_OPENING_BALANCE = '0.52000 BTC';
const SENDER_SETTLED_BALANCE = '0.41988 BTC';
const RECEIVER_OPENING_BALANCE = '0.03000 BTC';
const RECEIVER_SETTLED_BALANCE = '0.13000 BTC';

const stageOrder: readonly Stage[] = [
  'verify-receiver',
  'review-intro',
  'amount',
  'recipient',
  'approve',
  'signing',
  'broadcast',
  'confirmed',
  'complete',
];

const networkOrder = ['address', 'review', 'signature', 'broadcast', 'confirmed', 'sync'] as const;

type NetworkNode = (typeof networkOrder)[number];

const networkStage: Record<Stage, NetworkNode> = {
  'verify-receiver': 'address',
  'review-intro': 'review',
  amount: 'review',
  recipient: 'review',
  approve: 'review',
  signing: 'signature',
  broadcast: 'broadcast',
  confirmed: 'confirmed',
  complete: 'sync',
};

function setText(scene: HTMLElement, selector: string, value: string): void {
  const target = scene.querySelector<HTMLElement>(selector);
  if (target) target.textContent = value;
}

function setScreen(device: HTMLElement, copy: ScreenCopy): void {
  device.setAttribute('state', copy.state);
  device.setAttribute('screen-title', copy.title);
  device.setAttribute('screen-line-1', copy.line1);
  device.setAttribute('screen-line-2', copy.line2);
  device.setAttribute('screen-footer', copy.footer);
  device.setAttribute('left-label', copy.left);
  device.setAttribute('right-label', copy.right);
}

function pulse(device: HTMLElement, gesture: Gesture): void {
  device.setAttribute('pressed', gesture);
  window.setTimeout(() => device.setAttribute('pressed', 'none'), 130);
}

function senderCopy(stage: Stage): ScreenCopy {
  switch (stage) {
    case 'verify-receiver':
      return {
        state: 'menu',
        title: 'BITCOIN',
        line1: 'WAITING FOR RECIPIENT',
        line2: 'NO TRANSACTION YET',
        footer: 'RECEIVER MUST VERIFY',
        left: '<',
        right: '>',
      };
    case 'review-intro':
      return {
        state: 'review',
        title: 'REVIEW TRANSACTION',
        line1: 'BITCOIN · 1 OF 5',
        line2: 'SCROLL EVERY FIELD',
        footer: 'RIGHT = NEXT',
        left: '<',
        right: '>',
      };
    case 'amount':
      return {
        state: 'review',
        title: 'AMOUNT',
        line1: '0.10 BTC',
        line2: 'NETWORK: BITCOIN',
        footer: 'VERIFY ON DEVICE',
        left: '<',
        right: '>',
      };
    case 'recipient':
      return {
        state: 'review',
        title: 'RECIPIENT',
        line1: 'BC1Q...7X2',
        line2: 'FEE 0.00012 BTC',
        footer: 'VERIFY ON DEVICE',
        left: '<',
        right: '>',
      };
    case 'approve':
      return {
        state: 'review',
        title: 'APPROVE',
        line1: 'SIGN THIS TRANSACTION',
        line2: 'PRIVATE KEY STAYS INSIDE',
        footer: 'PRESS BOTH BUTTONS',
        left: '<',
        right: '>',
      };
    case 'signing':
      return {
        state: 'approved',
        title: 'APPROVED',
        line1: 'SIGNING SECP256K1',
        line2: 'PRIVATE KEY NOT EXPORTED',
        footer: 'PHYSICAL INPUT LOCKED',
        left: 'WAIT',
        right: 'WAIT',
      };
    case 'broadcast':
    case 'confirmed':
    case 'complete':
      return {
        state: 'signed',
        title: 'SIGNATURE READY',
        line1: 'RETURNED TO HOST',
        line2: 'PRIVATE KEY STAYED HERE',
        footer: 'HOST MAY BROADCAST',
        left: '',
        right: '',
      };
  }
}

function receiverCopy(verified: boolean): ScreenCopy {
  if (!verified) {
    return {
      state: 'review',
      title: 'RECEIVE',
      line1: 'BC1Q...7X2',
      line2: 'VERIFY ON DEVICE',
      footer: 'PRESS BOTH BUTTONS',
      left: '<',
      right: '>',
    };
  }
  return {
    state: 'approved',
    title: 'ADDRESS VERIFIED',
    line1: 'BC1Q...7X2',
    line2: 'SAFE TO DISCONNECT',
    footer: 'CHAIN OWNS THE BALANCE',
    left: '',
    right: '',
  };
}

function bindPhysicalButton(
  device: HTMLElement,
  part: 'button-left' | 'button-right',
  onPress: () => void,
): void {
  const bind = (): void => {
    const button = device.shadowRoot?.querySelector<SVGGElement>(`[data-part="${part}"]`);
    if (!button) {
      window.requestAnimationFrame(bind);
      return;
    }
    if (button.dataset.transferBound === 'true') return;
    button.dataset.transferBound = 'true';
    button.addEventListener('click', onPress);
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onPress();
    });
  };
  bind();
}

function bindTransferScene(scene: HTMLElement): void {
  if (scene.dataset.bound === 'true') return;
  scene.dataset.bound = 'true';

  const sender = scene.querySelector<HTMLElement>('[data-transfer-sender]');
  const receiver = scene.querySelector<HTMLElement>('[data-transfer-receiver]');
  if (!sender || !receiver) return;

  const senderLeft = scene.querySelector<HTMLButtonElement>('[data-sender-left]');
  const senderRight = scene.querySelector<HTMLButtonElement>('[data-sender-right]');
  const senderConfirm = scene.querySelector<HTMLButtonElement>('[data-sender-confirm]');
  const receiverLeft = scene.querySelector<HTMLButtonElement>('[data-receiver-left]');
  const receiverRight = scene.querySelector<HTMLButtonElement>('[data-receiver-right]');
  const receiverConfirm = scene.querySelector<HTMLButtonElement>('[data-receiver-confirm]');
  const receiverSync = scene.querySelector<HTMLButtonElement>('[data-receiver-sync]');
  const reset = scene.querySelector<HTMLButtonElement>('[data-transfer-reset]');

  let stage: Stage = 'verify-receiver';
  let receiverVerified = false;
  let timerIds: number[] = [];

  const clearTimers = (): void => {
    for (const id of timerIds) window.clearTimeout(id);
    timerIds = [];
  };

  const later = (callback: () => void, delay: number): void => {
    timerIds.push(window.setTimeout(callback, delay));
  };

  const setControls = (): void => {
    const senderCanNavigate = ['review-intro', 'amount', 'recipient', 'approve'].includes(stage);
    if (senderLeft) senderLeft.disabled = !senderCanNavigate;
    if (senderRight) senderRight.disabled = !senderCanNavigate;
    if (senderConfirm) senderConfirm.disabled = stage !== 'approve';
    if (receiverLeft) receiverLeft.disabled = receiverVerified;
    if (receiverRight) receiverRight.disabled = receiverVerified;
    if (receiverConfirm) receiverConfirm.disabled = receiverVerified;
    if (receiverSync) receiverSync.disabled = stage !== 'confirmed';
  };

  const renderNetwork = (): void => {
    const active = networkStage[stage];
    const activeIndex = networkOrder.indexOf(active);
    scene.querySelectorAll<HTMLElement>('[data-network-node]').forEach((node) => {
      const name = node.dataset.networkNode as NetworkNode | undefined;
      if (!name) return;
      const index = networkOrder.indexOf(name);
      node.classList.toggle('is-active', index === activeIndex);
      node.classList.toggle('is-complete', index < activeIndex || stage === 'complete');
    });
  };

  const render = (): void => {
    scene.dataset.stage = stage;
    setScreen(sender, senderCopy(stage));
    setScreen(receiver, receiverCopy(receiverVerified));

    if (receiverVerified) receiver.removeAttribute('connected');
    else receiver.setAttribute('connected', '');
    sender.setAttribute('connected', '');

    const senderSettled = stage === 'confirmed' || stage === 'complete';
    setText(scene, '[data-sender-balance]', senderSettled ? SENDER_SETTLED_BALANCE : SENDER_OPENING_BALANCE);
    setText(scene, '[data-receiver-balance]', stage === 'complete' ? RECEIVER_SETTLED_BALANCE : RECEIVER_OPENING_BALANCE);

    switch (stage) {
      case 'verify-receiver':
        setText(scene, '[data-transfer-status]', 'Nothing can be sent until wallet B physically verifies the destination address.');
        setText(scene, '[data-ledger-state]', 'no transaction');
        setText(scene, '[data-transfer-tx-state]', 'not constructed');
        setText(scene, '[data-transfer-txid]', '—');
        setText(scene, '[data-sender-host-state]', 'Waiting for B to verify its address');
        setText(scene, '[data-receiver-host-state]', 'Address waiting for physical verification');
        break;
      case 'review-intro':
      case 'amount':
      case 'recipient':
      case 'approve':
        setText(scene, '[data-transfer-status]', 'Host A may propose fields, but wallet A must independently show and approve the exact spend.');
        setText(scene, '[data-ledger-state]', 'unsigned proposal');
        setText(scene, '[data-transfer-tx-state]', 'constructed · unsigned');
        setText(scene, '[data-transfer-txid]', '—');
        setText(scene, '[data-sender-host-state]', 'Transaction prepared from B’s verified address');
        setText(scene, '[data-receiver-host-state]', 'Address verified · hardware wallet unplugged');
        break;
      case 'signing':
        setText(scene, '[data-transfer-status]', 'The physical chord on A authorized private-key use. No network state has changed yet.');
        setText(scene, '[data-ledger-state]', 'private-key execution');
        setText(scene, '[data-transfer-tx-state]', 'approved · signing');
        setText(scene, '[data-transfer-txid]', '—');
        setText(scene, '[data-sender-host-state]', 'Waiting for signature bytes from wallet A');
        setText(scene, '[data-receiver-host-state]', 'Offline · address remains valid');
        break;
      case 'broadcast':
        setText(scene, '[data-transfer-status]', 'A signature is not settlement. Host A broadcasts the signed transaction and waits for network confirmation.');
        setText(scene, '[data-ledger-state]', 'mempool · unconfirmed');
        setText(scene, '[data-transfer-tx-state]', 'signed · broadcasting');
        setText(scene, '[data-transfer-txid]', TXID);
        setText(scene, '[data-sender-host-state]', 'Broadcast accepted · waiting for confirmation');
        setText(scene, '[data-receiver-host-state]', 'Offline · no device connection required');
        break;
      case 'confirmed':
        setText(scene, '[data-transfer-status]', 'The ledger now assigns 0.10 BTC to B’s verified address. Wallet B still does not need to be connected.');
        setText(scene, '[data-ledger-state]', '1 confirmation · settled');
        setText(scene, '[data-transfer-tx-state]', 'confirmed · receiver not synced');
        setText(scene, '[data-transfer-txid]', TXID);
        setText(scene, '[data-sender-host-state]', `Settled balance ${SENDER_SETTLED_BALANCE}`);
        setText(scene, '[data-receiver-host-state]', 'Chain changed · local account view is stale');
        break;
      case 'complete':
        setText(scene, '[data-transfer-status]', 'End to end complete: B verified an address, A authorized a spend, Bitcoin settled it, and host B observed the result.');
        setText(scene, '[data-ledger-state]', 'confirmed · receiver indexed');
        setText(scene, '[data-transfer-tx-state]', 'confirmed · synced');
        setText(scene, '[data-transfer-txid]', TXID);
        setText(scene, '[data-sender-host-state]', `Settled balance ${SENDER_SETTLED_BALANCE}`);
        setText(scene, '[data-receiver-host-state]', `Synced balance ${RECEIVER_SETTLED_BALANCE}`);
        break;
    }

    renderNetwork();
    setControls();
  };

  const setStage = (next: Stage): void => {
    stage = next;
    render();
  };

  const receiverPress = (gesture: Gesture): void => {
    if (receiverVerified) return;
    pulse(receiver, gesture);
    if (gesture !== 'both') return;
    receiverVerified = true;
    setStage('review-intro');
  };

  const senderPress = (gesture: Gesture): void => {
    if (!['review-intro', 'amount', 'recipient', 'approve'].includes(stage)) return;
    pulse(sender, gesture);

    if (gesture === 'both') {
      if (stage !== 'approve') return;
      setStage('signing');
      later(() => setStage('broadcast'), 720);
      later(() => setStage('confirmed'), 1_850);
      return;
    }

    const navigation: readonly Stage[] = ['review-intro', 'amount', 'recipient', 'approve'];
    const currentIndex = navigation.indexOf(stage);
    if (gesture === 'right' && currentIndex < navigation.length - 1) {
      setStage(navigation[currentIndex + 1] ?? stage);
    } else if (gesture === 'left' && currentIndex > 0) {
      setStage(navigation[currentIndex - 1] ?? stage);
    }
  };

  const restart = (): void => {
    clearTimers();
    stage = 'verify-receiver';
    receiverVerified = false;
    sender.setAttribute('pressed', 'none');
    receiver.setAttribute('pressed', 'none');
    render();
  };

  senderLeft?.addEventListener('click', () => senderPress('left'));
  senderRight?.addEventListener('click', () => senderPress('right'));
  senderConfirm?.addEventListener('click', () => senderPress('both'));
  receiverLeft?.addEventListener('click', () => receiverPress('left'));
  receiverRight?.addEventListener('click', () => receiverPress('right'));
  receiverConfirm?.addEventListener('click', () => receiverPress('both'));
  receiverSync?.addEventListener('click', () => {
    if (stage === 'confirmed') setStage('complete');
  });
  reset?.addEventListener('click', restart);

  bindPhysicalButton(sender, 'button-left', () => senderPress('left'));
  bindPhysicalButton(sender, 'button-right', () => senderPress('right'));
  bindPhysicalButton(receiver, 'button-left', () => receiverPress('left'));
  bindPhysicalButton(receiver, 'button-right', () => receiverPress('right'));

  restart();
}

customElements.whenDefined('ee-hardware-wallet').then(() => {
  document
    .querySelectorAll<HTMLElement>('[data-wallet-transfer-scene]')
    .forEach((scene) => bindTransferScene(scene));
});
