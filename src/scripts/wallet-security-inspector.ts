type SecurityMode = 'prototype' | 'secure-element';
type MemoryPhase = 'idle' | 'signing' | 'after';

interface MemoryView {
  readonly region: string;
  readonly line0: string;
  readonly line1: string;
  readonly ascii: string;
  readonly matches: string;
  readonly verdict: string;
  readonly note: string;
  readonly safe: boolean;
}

const zeroLine = '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00';
const noise0 = '57 4C 54 31 02 16 2E 47 52 45 56 49 45 57 20 54';
const noise1 = '52 41 4E 53 41 43 54 49 4F 4E 00 30 2E 31 30 20';
const canary0 = '5A 5B 5C 5D 5E 5F 60 61 62 63 64 65 66 67 68 69';
const canary1 = '6A 6B 6C 6D 6E 6F 70 71 72 73 74 75 76 77 78 79';

const prototypeViews: Record<MemoryPhase, MemoryView> = {
  idle: {
    region: 'MCU working RAM · before key lifecycle',
    line0: noise0,
    line1: noise1,
    ascii: 'WLT1..GREVIEW TRANSACTION.0.10 ',
    matches: 'canary matches: 0 at this checkpoint',
    verdict: 'INCOMPLETE · an idle dump says nothing about the signing window',
    note: 'The absence of a secret before derivation is not a security result. The scanner must cover every point at which root material or a private scalar can exist.',
    safe: true,
  },
  signing: {
    region: 'ProbeStore.root / software signer working set',
    line0: canary0,
    line1: canary1,
    ascii: 'Z[\\]^_`abcdefghijklmnopqrstuvwxy',
    matches: 'canary matches: 1+',
    verdict: 'FAIL · secret-bearing storage exists in MCU space',
    note: 'The current firmware-budget fixture starts entropy at 0x5A and persists those bytes in ProbeStore. With SoftwareKeyBackend, a memory-disclosure attacker can target the exact window we care about.',
    safe: false,
  },
  after: {
    region: 'MCU working RAM · after lifecycle.wipe / Drop',
    line0: zeroLine,
    line1: zeroLine,
    ascii: '................................',
    matches: 'canary matches: 0 after teardown',
    verdict: 'PARTIAL PASS · zeroization narrows the exposure window',
    note: 'Zeroization is still valuable, but “secret existed for a short time in MCU RAM” is weaker than “secret was never MCU-readable.”',
    safe: true,
  },
};

const secureElementViews: Record<MemoryPhase, MemoryView> = {
  idle: {
    region: 'MCU RAM · WLT1 frame / protocol buffers',
    line0: noise0,
    line1: noise1,
    ascii: 'WLT1..GREVIEW TRANSACTION.0.10 ',
    matches: 'canary matches: 0',
    verdict: 'PASS · no secret canary in MCU-visible memory',
    note: 'The target gate scans all MCU RAM and Flash, not just this excerpt. The secure-element canary exists outside the MCU address map.',
    safe: true,
  },
  signing: {
    region: 'MCU RAM · digest + signer response buffers',
    line0: '8E C1 4F 2B 79 1A C9 3E 6B 72 00 C4 6D 18 E8 11',
    line1: '30 44 02 20 63 91 C2 5F 91 17 4E 3D 92 01 A4 76',
    ascii: '..O+y..>kr..m...0D. c.._..N=...v',
    matches: 'canary matches: 0',
    verdict: 'PASS · MCU sees digest/signature, never private scalar',
    note: 'Allowed data crossing the boundary is public derivation metadata, transaction digest, public key and signature. Seed/private scalars are forbidden in both directions.',
    safe: true,
  },
  after: {
    region: 'MCU RAM · post-signing buffers',
    line0: zeroLine,
    line1: '30 44 02 20 63 91 C2 5F 91 17 4E 3D 92 01 A4 76',
    ascii: '................0D. c.._..N=...v',
    matches: 'canary matches: 0',
    verdict: 'PASS · transient MCU buffers cleared; signature may remain public',
    note: 'A signature is not secret. Clearing digest/work buffers is hygiene; key isolation comes from never mapping the signer secret into MCU memory at all.',
    safe: true,
  },
};

function text(root: HTMLElement, selector: string, value: string): void {
  const target = root.querySelector<HTMLElement>(selector);
  if (target) target.textContent = value;
}

function bindSecurityInspector(root: HTMLElement): void {
  if (root.dataset.bound === 'true') return;
  root.dataset.bound = 'true';

  let mode: SecurityMode = 'prototype';
  let phase: MemoryPhase = 'signing';

  const render = (): void => {
    root.querySelectorAll<HTMLButtonElement>('[data-security-mode]').forEach((button) => {
      const selected = button.dataset.securityMode === mode;
      button.setAttribute('aria-selected', String(selected));
    });
    root.querySelectorAll<HTMLButtonElement>('[data-memory-phase]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.memoryPhase === phase);
    });

    const views = mode === 'prototype' ? prototypeViews : secureElementViews;
    const view = views[phase];
    const inspector = root.querySelector<HTMLElement>('.memory-inspector');
    if (inspector) inspector.dataset.memorySafe = String(view.safe);

    text(root, '[data-memory-region]', view.region);
    text(root, '[data-memory-line="0"]', view.line0);
    text(root, '[data-memory-line="1"]', view.line1);
    text(root, '[data-memory-ascii]', view.ascii);
    text(root, '[data-memory-matches]', view.matches);
    text(root, '[data-memory-verdict]', view.verdict);
    text(root, '[data-memory-note]', view.note);

    if (mode === 'prototype') {
      text(root, '[data-boundary-title]', 'Not yet the production architecture');
      text(root, '[data-se-read]', 'MCU READ → key material is local');
      text(root, '[data-se-secret]', 'ProbeStore and SoftwareKeyBackend keep root/key work inside MCU-addressable software.');
      text(root, '[data-se-transcript]', 'prototype:\nseed → MCU key backend\nprivate scalar → MCU signer\nsignature → host');
      text(root, '[data-gate-memory]', phase === 'signing' ? 'prototype: FAIL' : 'prototype: checkpoint only');
      text(root, '[data-gate-bus]', 'prototype: no isolated bus');
    } else {
      text(root, '[data-boundary-title]', 'Target: key never enters MCU');
      text(root, '[data-se-read]', 'MCU READ → DENIED / not memory-mapped');
      text(root, '[data-se-secret]', 'Canary seed + derived private keys exist only in secure signer state. The MCU has no read primitive for that storage.');
      text(root, '[data-se-transcript]', 'allowed MCU → SE:\n  derive(path)\n  sign(tx_digest)\n\nallowed SE → MCU:\n  public_key\n  signature\n\nforbidden both directions:\n  seed\n  private_scalar');
      text(root, '[data-gate-memory]', 'target gate: 0 canary matches');
      text(root, '[data-gate-bus]', 'target gate: 0 secret bytes');
    }
  };

  root.querySelectorAll<HTMLButtonElement>('[data-security-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.securityMode === 'secure-element' ? 'secure-element' : 'prototype';
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-memory-phase]').forEach((button) => {
    button.addEventListener('click', () => {
      const candidate = button.dataset.memoryPhase;
      if (candidate === 'idle' || candidate === 'signing' || candidate === 'after') {
        phase = candidate;
        render();
      }
    });
  });

  render();
}

document
  .querySelectorAll<HTMLElement>('[data-wallet-security]')
  .forEach((root) => bindSecurityInspector(root));
