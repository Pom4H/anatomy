export type MotionAction =
  | 'reveal'
  | 'focus'
  | 'draw-path'
  | 'flow'
  | 'transform'
  | 'compare'
  | 'reject';

export type WalletSceneId =
  | 'mental-model'
  | 'keys'
  | 'software-wallet'
  | 'hardware-wallet'
  | 'mismatch'
  | 'recovery'
  | 'comparison';

export interface ConceptNode {
  readonly id: string;
  readonly kind:
    | 'human'
    | 'ledger'
    | 'software'
    | 'hardware'
    | 'key'
    | 'payload'
    | 'network'
    | 'backup';
  readonly label: string;
  readonly trustZone: 'human' | 'host' | 'device' | 'network' | 'offline';
}

export interface MotionBeat {
  readonly id: string;
  readonly scene: WalletSceneId;
  readonly action: MotionAction;
  readonly targets: readonly string[];
  readonly narration: string;
}

export interface WalletScene {
  readonly id: WalletSceneId;
  readonly index: string;
  readonly kicker: string;
  readonly title: string;
  readonly caption: string;
  readonly from: number;
  readonly duration: number;
}

export const WALLET_VIDEO = {
  id: 'WalletSigning',
  fps: 30,
  width: 1600,
  height: 900,
  durationInFrames: 2700,
} as const;

export const WALLET_SCENES: readonly WalletScene[] = [
  {
    id: 'mental-model',
    index: '01',
    kicker: 'Mental model',
    title: 'Wallets do not store coins',
    caption: 'The ledger records assets. The wallet controls the authority to change that record.',
    from: 0,
    duration: 240,
  },
  {
    id: 'keys',
    index: '02',
    kicker: 'Cryptographic objects',
    title: 'Four objects, four different jobs',
    caption: 'Private keys create signatures. Public keys verify them. Addresses identify destinations.',
    from: 240,
    duration: 360,
  },
  {
    id: 'software-wallet',
    index: '03',
    kicker: 'Software wallet',
    title: 'One device prepares, reviews, and signs',
    caption: 'The same general-purpose operating system contains the interface and the signing capability.',
    from: 600,
    duration: 450,
  },
  {
    id: 'hardware-wallet',
    index: '04',
    kicker: 'Hardware wallet',
    title: 'Signing moves behind a separate boundary',
    caption: 'The host prepares the transaction; the device independently reviews and signs it.',
    from: 1050,
    duration: 600,
  },
  {
    id: 'mismatch',
    index: '05',
    kicker: 'Attack path',
    title: 'A trusted display can expose a lie',
    caption: 'The protection works only when the user compares and verifies what the device shows.',
    from: 1650,
    duration: 390,
  },
  {
    id: 'recovery',
    index: '06',
    kicker: 'Recovery',
    title: 'The backup recreates the wallet',
    caption: 'A lost device can be replaced. A stolen recovery secret can recreate the wallet too.',
    from: 2040,
    duration: 300,
  },
  {
    id: 'comparison',
    index: '07',
    kicker: 'Final model',
    title: 'Same job. Different signing boundary.',
    caption: 'Hardware changes where review and signing happen; it does not remove the need for careful recovery.',
    from: 2340,
    duration: 360,
  },
] as const;

export const WALLET_CONCEPTS: readonly ConceptNode[] = [
  {id: 'human', kind: 'human', label: 'Human intent', trustZone: 'human'},
  {id: 'ledger', kind: 'ledger', label: 'Blockchain ledger', trustZone: 'network'},
  {id: 'wallet', kind: 'software', label: 'Wallet', trustZone: 'host'},
  {id: 'private-key', kind: 'key', label: 'Private key', trustZone: 'device'},
  {id: 'public-key', kind: 'key', label: 'Public key', trustZone: 'host'},
  {id: 'address', kind: 'key', label: 'Address', trustZone: 'network'},
  {id: 'signature', kind: 'payload', label: 'Signature', trustZone: 'network'},
  {id: 'unsigned-transaction', kind: 'payload', label: 'Unsigned transaction', trustZone: 'host'},
  {id: 'signed-transaction', kind: 'payload', label: 'Signed transaction', trustZone: 'network'},
  {id: 'software-host', kind: 'software', label: 'Phone or computer', trustZone: 'host'},
  {id: 'hardware-device', kind: 'hardware', label: 'Hardware signer', trustZone: 'device'},
  {id: 'network', kind: 'network', label: 'Blockchain network', trustZone: 'network'},
  {id: 'recovery', kind: 'backup', label: 'Recovery secret', trustZone: 'offline'},
  {id: 'replacement', kind: 'hardware', label: 'Replacement wallet', trustZone: 'device'},
] as const;

export const WALLET_BEATS: readonly MotionBeat[] = [
  {
    id: 'move-asset-to-ledger',
    scene: 'mental-model',
    action: 'transform',
    targets: ['ledger', 'wallet'],
    narration: 'Move the asset out of the wallet and leave it on the shared ledger.',
  },
  {
    id: 'reveal-wallet-authority',
    scene: 'mental-model',
    action: 'reveal',
    targets: ['private-key', 'address', 'signature'],
    narration: 'Replace the asset with the objects a wallet actually controls.',
  },
  {
    id: 'derive-public-identity',
    scene: 'keys',
    action: 'draw-path',
    targets: ['private-key', 'public-key', 'address'],
    narration: 'Show the one-way derivation from secret key material to public identity.',
  },
  {
    id: 'sign-one-payload',
    scene: 'keys',
    action: 'transform',
    targets: ['private-key', 'unsigned-transaction', 'signature'],
    narration: 'Bind approval to one specific payload by creating a signature.',
  },
  {
    id: 'software-flow',
    scene: 'software-wallet',
    action: 'flow',
    targets: ['human', 'software-host', 'unsigned-transaction', 'private-key', 'signed-transaction', 'network'],
    narration: 'Keep preparation, approval, key access, and broadcast inside one general-purpose device.',
  },
  {
    id: 'cross-device-boundary',
    scene: 'hardware-wallet',
    action: 'flow',
    targets: ['software-host', 'unsigned-transaction', 'hardware-device'],
    narration: 'Move the unsigned transaction, not the private key, across the USB boundary.',
  },
  {
    id: 'device-owned-review',
    scene: 'hardware-wallet',
    action: 'focus',
    targets: ['hardware-device', 'unsigned-transaction', 'human'],
    narration: 'Decode and review the transaction on the device before signing.',
  },
  {
    id: 'return-signature',
    scene: 'hardware-wallet',
    action: 'transform',
    targets: ['private-key', 'signature', 'signed-transaction', 'network'],
    narration: 'Return a signature or signed transaction while the private key stays inside the signer.',
  },
  {
    id: 'detect-mismatch',
    scene: 'mismatch',
    action: 'compare',
    targets: ['software-host', 'hardware-device', 'human'],
    narration: 'Compare the host claim with the independently decoded device review.',
  },
  {
    id: 'reject-mismatch',
    scene: 'mismatch',
    action: 'reject',
    targets: ['unsigned-transaction', 'hardware-device'],
    narration: 'Stop the flow when the displayed operation does not match human intent.',
  },
  {
    id: 'recover-key-tree',
    scene: 'recovery',
    action: 'draw-path',
    targets: ['recovery', 'private-key', 'replacement'],
    narration: 'Regenerate the same deterministic wallet from the recovery secret.',
  },
  {
    id: 'compare-boundaries',
    scene: 'comparison',
    action: 'compare',
    targets: ['software-host', 'hardware-device', 'private-key', 'recovery'],
    narration: 'End on one stable comparison of the two signing boundaries.',
  },
] as const;

export const validateWalletModel = (): void => {
  const sceneIds = new Set(WALLET_SCENES.map((scene) => scene.id));
  const conceptIds = new Set(WALLET_CONCEPTS.map((concept) => concept.id));

  for (const beat of WALLET_BEATS) {
    if (!sceneIds.has(beat.scene)) {
      throw new Error(`Unknown wallet scene: ${beat.scene}`);
    }

    for (const target of beat.targets) {
      if (!conceptIds.has(target)) {
        throw new Error(`Unknown wallet concept target: ${target}`);
      }
    }
  }

  const finalFrame = Math.max(...WALLET_SCENES.map((scene) => scene.from + scene.duration));
  if (finalFrame !== WALLET_VIDEO.durationInFrames) {
    throw new Error(`Wallet timeline ends at ${finalFrame}, expected ${WALLET_VIDEO.durationInFrames}`);
  }
};

validateWalletModel();
