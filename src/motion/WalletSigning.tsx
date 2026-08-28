import type {ComponentType} from 'react';
import {AbsoluteFill, Composition, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {WALLET_SCENES, WALLET_VIDEO, type WalletSceneId} from './wallet-model';
import {C, clamp} from './primitives';
import {KeysScene, MentalModelScene, SoftwareWalletScene} from './scenes-foundation';
import {ComparisonScene, HardwareWalletScene, MismatchScene, RecoveryScene} from './scenes-security';

const TimelineRail = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 30,
        left: 72,
        right: 72,
        bottom: 13,
        display: 'grid',
        gridTemplateColumns: WALLET_SCENES.map((scene) => `${scene.duration}fr`).join(' '),
        gap: 6,
      }}
    >
      {WALLET_SCENES.map((scene) => {
        const p = interpolate(frame, [scene.from, scene.from + scene.duration], [0, 1], clamp);
        const active = frame >= scene.from && frame < scene.from + scene.duration;
        return (
          <div key={scene.id} style={{height: 4, overflow: 'hidden', background: C.rule}}>
            <div
              style={{
                width: `${p * 100}%`,
                height: '100%',
                background: active ? C.red : C.ink,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const scenes: Record<WalletSceneId, ComponentType> = {
  'mental-model': MentalModelScene,
  keys: KeysScene,
  'software-wallet': SoftwareWalletScene,
  'hardware-wallet': HardwareWalletScene,
  mismatch: MismatchScene,
  recovery: RecoveryScene,
  comparison: ComparisonScene,
};

export const WalletSigningComposition = () => (
  <AbsoluteFill style={{background: C.paper, overflow: 'hidden'}}>
    {WALLET_SCENES.map((scene) => {
      const Scene = scenes[scene.id];
      return (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.duration} premountFor={30}>
          <Scene />
        </Sequence>
      );
    })}
    <TimelineRail />
  </AbsoluteFill>
);

export const RemotionRoot = () => (
  <Composition
    id={WALLET_VIDEO.id}
    component={WalletSigningComposition}
    durationInFrames={WALLET_VIDEO.durationInFrames}
    fps={WALLET_VIDEO.fps}
    width={WALLET_VIDEO.width}
    height={WALLET_VIDEO.height}
  />
);
