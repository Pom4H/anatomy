import {Player} from '@remotion/player';
import {WALLET_VIDEO} from './wallet-model';
import {C} from './primitives';
import {WalletSigningComposition} from './WalletSigning';

export const WalletMotionPlayer = () => (
  <div
    role="group"
    aria-label="Animated explanation comparing how software and hardware wallets sign a transaction"
    style={{width: '100%', background: C.paperDeep}}
  >
    <Player
      acknowledgeRemotionLicense
      component={WalletSigningComposition}
      compositionWidth={WALLET_VIDEO.width}
      compositionHeight={WALLET_VIDEO.height}
      durationInFrames={WALLET_VIDEO.durationInFrames}
      fps={WALLET_VIDEO.fps}
      controls
      clickToPlay
      spaceKeyToPlayOrPause
      loop={false}
      style={{width: '100%', aspectRatio: `${WALLET_VIDEO.width} / ${WALLET_VIDEO.height}`}}
    />
  </div>
);
