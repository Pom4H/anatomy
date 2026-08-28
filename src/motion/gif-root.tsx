import type {ComponentType, ReactNode} from 'react';
import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Freeze,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loopCompositions} from './loops';

const paper = '#f4f0e8';
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const LoopEnvelope = ({children}: {children: ReactNode}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const animatedOpacity = interpolate(
    frame,
    [0, 8, durationInFrames - 12, durationInFrames - 1],
    [0, 1, 1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{background: paper}}>
      <Freeze frame={0}>{children}</Freeze>
      <AbsoluteFill style={{opacity: animatedOpacity}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const wrappedCompositions = loopCompositions.map((loop) => {
  const Scene = loop.component as ComponentType;
  const Wrapped = () => (
    <LoopEnvelope>
      <Scene />
    </LoopEnvelope>
  );

  return {...loop, component: Wrapped};
});

export const GifRoot = () => (
  <>
    {wrappedCompositions.map((loop) => (
      <Composition
        key={loop.id}
        id={loop.id}
        component={loop.component}
        durationInFrames={loop.durationInFrames}
        fps={20}
        width={960}
        height={540}
      />
    ))}
  </>
);
