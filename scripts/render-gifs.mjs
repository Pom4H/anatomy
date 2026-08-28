import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const entry = 'src/motion/index.ts';
const outputDir = 'public/generated/wallets';

const loops = [
  ['WalletLedgerLoop', 'wallet-ledger.gif'],
  ['KeySignatureLoop', 'keys-signature.gif'],
  ['RecoveryTreeLoop', 'recovery-tree.gif'],
  ['SoftwareSigningLoop', 'software-signing.gif'],
  ['HardwareSigningLoop', 'hardware-signing.gif'],
  ['MismatchRejectedLoop', 'mismatch-rejected.gif'],
];

mkdirSync(outputDir, {recursive: true});

for (const [composition, file] of loops) {
  const result = spawnSync(
    'remotion',
    [
      'render',
      entry,
      composition,
      `${outputDir}/${file}`,
      '--codec=gif',
      '--every-nth-frame=2',
      '--concurrency=2',
      '--overwrite',
    ],
    {stdio: 'inherit', shell: process.platform === 'win32'},
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
