import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame} from 'remotion';
import {WALLET_SCENES, WALLET_VIDEO, type WalletSceneId} from './wallet-model';

export const C = {
  paper: '#f4f0e8',
  paperDeep: '#e7e0d4',
  ink: '#171713',
  muted: '#6f6a61',
  rule: '#bbb3a7',
  blue: '#2f6fed',
  blueSoft: '#dce7ff',
  amber: '#d9961f',
  amberSoft: '#f7e7bd',
  green: '#187a45',
  greenSoft: '#d9eedf',
  red: '#cf4938',
  redSoft: '#f4d8d2',
  white: '#fffdf8',
} as const;

export const sans = 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const mono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

export const smooth = (frame: number, start: number, duration: number): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });

export const fade = (frame: number, start: number, duration = 12): number =>
  interpolate(frame, [start, start + duration], [0, 1], clamp);

export const enter = (
  frame: number,
  start: number,
  distance = 22,
  scaleFrom = 0.98,
): CSSProperties => {
  const progress = spring({
    fps: WALLET_VIDEO.fps,
    frame: Math.max(0, frame - start),
    config: {damping: 18, stiffness: 130, mass: 0.7},
  });
  const opacity = interpolate(frame, [start, start + 8], [0, 1], clamp);
  return {
    opacity,
    transform: `translateY(${(1 - progress) * distance}px) scale(${scaleFrom + progress * (1 - scaleFrom)})`,
  };
};

export const sceneOpacity = (frame: number, duration: number, final = false): number => {
  const intro = interpolate(frame, [0, 14], [0, 1], clamp);
  if (final) return intro;
  const outro = interpolate(frame, [duration - 18, duration], [1, 0], clamp);
  return Math.min(intro, outro);
};

export const sceneById = (id: WalletSceneId) => {
  const scene = WALLET_SCENES.find((candidate) => candidate.id === id);
  if (!scene) throw new Error(`Unknown wallet scene: ${id}`);
  return scene;
};

export const Grid = () => (
  <AbsoluteFill
    style={{
      backgroundColor: C.paper,
      backgroundImage:
        'linear-gradient(rgba(23,23,19,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,19,.035) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
    }}
  />
);

export const SceneShell = ({
  id,
  children,
  final = false,
}: {
  readonly id: WalletSceneId;
  readonly children: ReactNode;
  readonly final?: boolean;
}) => {
  const frame = useCurrentFrame();
  const scene = sceneById(id);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, scene.duration, final)}}>
      <Grid />
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 28,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: mono,
          fontSize: 15,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.muted,
        }}
      >
        <span>ANATOMY / WALLET FUNDAMENTALS</span>
        <span style={{color: C.ink}}>{scene.index} / 07</span>
      </div>

      <div style={{position: 'absolute', left: 72, top: 70, right: 72}}>
        <div
          style={{
            ...enter(frame, 0, 12),
            color: C.red,
            fontFamily: mono,
            fontSize: 17,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {scene.kicker}
        </div>
        <h1
          style={{
            ...enter(frame, 4, 18),
            maxWidth: 1250,
            margin: '10px 0 0',
            color: C.ink,
            fontFamily: sans,
            fontSize: 64,
            fontWeight: 760,
            lineHeight: 0.98,
            letterSpacing: '-0.055em',
          }}
        >
          {scene.title}
        </h1>
      </div>

      {children}

      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          bottom: 42,
          display: 'grid',
          gridTemplateColumns: '126px 1fr',
          gap: 24,
          alignItems: 'start',
          paddingTop: 16,
          borderTop: `1px solid ${C.ink}`,
          color: C.ink,
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: C.red,
          }}
        >
          Core idea
        </span>
        <span style={{fontFamily: sans, fontSize: 23, lineHeight: 1.25}}>{scene.caption}</span>
      </div>
    </AbsoluteFill>
  );
};

export const Box = ({
  x,
  y,
  width,
  height,
  label,
  detail,
  start = 0,
  accent = C.ink,
  fill = C.white,
  muted = false,
  children,
}: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly detail?: string;
  readonly start?: number;
  readonly accent?: string;
  readonly fill?: string;
  readonly muted?: boolean;
  readonly children?: ReactNode;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, start),
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        padding: '22px 24px',
        border: `2px solid ${muted ? C.rule : accent}`,
        background: fill,
        color: C.ink,
        fontFamily: sans,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
        }}
      >
        <strong style={{fontSize: 23, lineHeight: 1.05}}>{label}</strong>
        <span
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: accent,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {detail}
        </span>
      </div>
      {children}
    </div>
  );
};

export const Boundary = ({
  x,
  y,
  width,
  height,
  label,
  start = 0,
  color = C.ink,
  fill = 'rgba(255,253,248,.58)',
  dashed = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly start?: number;
  readonly color?: string;
  readonly fill?: string;
  readonly dashed?: boolean;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, start, 12, 0.995),
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        background: fill,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: -13,
          padding: '3px 9px',
          background: C.paper,
          color,
          fontFamily: mono,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const Tag = ({
  x,
  y,
  label,
  start = 0,
  color = C.ink,
  background = C.white,
}: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly start?: number;
  readonly color?: string;
  readonly background?: string;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, start, 12),
        position: 'absolute',
        left: x,
        top: y,
        padding: '9px 13px',
        border: `1.5px solid ${color}`,
        background,
        color,
        fontFamily: mono,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
};

export const Packet = ({
  x,
  y,
  label,
  start = 0,
  color = C.blue,
  background = C.blueSoft,
  width = 190,
  scale = 1,
  opacity,
}: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly start?: number;
  readonly color?: string;
  readonly background?: string;
  readonly width?: number;
  readonly scale?: number;
  readonly opacity?: number;
}) => {
  const frame = useCurrentFrame();
  const appeared = fade(frame, start, 8);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: opacity ?? appeared,
        padding: '14px 18px',
        border: `2px solid ${color}`,
        background,
        color,
        fontFamily: mono,
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: '0.035em',
        textAlign: 'center',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        boxShadow: '0 8px 24px rgba(23,23,19,.08)',
      }}
    >
      {label}
    </div>
  );
};

export const MovingPacket = ({
  from,
  to,
  label,
  start,
  duration,
  color = C.blue,
  background = C.blueSoft,
  width,
  hold = false,
}: {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly label: string;
  readonly start: number;
  readonly duration: number;
  readonly color?: string;
  readonly background?: string;
  readonly width?: number;
  readonly hold?: boolean;
}) => {
  const frame = useCurrentFrame();
  const p = smooth(frame, start, duration);
  const x = interpolate(p, [0, 1], [from[0], to[0]]);
  const y = interpolate(p, [0, 1], [from[1], to[1]]);
  const visibility = hold
    ? fade(frame, start, 5)
    : interpolate(frame, [start, start + 5, start + duration - 5, start + duration], [0, 1, 1, 0], clamp);
  return (
    <Packet
      x={x}
      y={y}
      label={label}
      color={color}
      background={background}
      width={width}
      opacity={visibility}
    />
  );
};

export const FlowLine = ({
  from,
  to,
  start,
  duration = 22,
  color = C.ink,
  dashed = false,
  label,
}: {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly start: number;
  readonly duration?: number;
  readonly color?: string;
  readonly dashed?: boolean;
  readonly label?: string;
}) => {
  const frame = useCurrentFrame();
  const p = smooth(frame, start, duration);
  const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  return (
    <>
      <svg
        width={WALLET_VIDEO.width}
        height={WALLET_VIDEO.height}
        viewBox={`0 0 ${WALLET_VIDEO.width} ${WALLET_VIDEO.height}`}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        <line
          x1={from[0]}
          y1={from[1]}
          x2={to[0]}
          y2={to[1]}
          pathLength={1}
          stroke={color}
          strokeWidth={3}
          strokeDasharray={dashed ? '0.025 0.025' : 1}
          strokeDashoffset={dashed ? 0 : 1 - p}
          opacity={p}
        />
        <polygon
          points="-17,-9 0,0 -17,9"
          fill={color}
          opacity={interpolate(p, [0.82, 1], [0, 1], clamp)}
          transform={`translate(${to[0]} ${to[1]}) rotate(${angle})`}
        />
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: midX,
            top: midY - 30,
            transform: 'translate(-50%, -50%)',
            opacity: p,
            padding: '4px 8px',
            background: C.paper,
            color,
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};

export const KeyGlyph = ({x, y, start = 0, color = C.red}: {x: number; y: number; start?: number; color?: string}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{...enter(frame, start, 10), position: 'absolute', left: x, top: y, width: 84, height: 84}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          width: 48,
          height: 48,
          border: `8px solid ${color}`,
          borderRadius: '50%',
        }}
      />
      <div style={{position: 'absolute', left: 44, top: 31, width: 40, height: 12, background: color}} />
      <div style={{position: 'absolute', right: 0, top: 39, width: 12, height: 22, background: color}} />
    </div>
  );
};

export const LedgerRows = ({start = 0}: {start?: number}) => {
  const frame = useCurrentFrame();
  const rows = [
    ['ACCOUNT', 'BALANCE'],
    ['0x71…9A', '2.00 ETH'],
    ['0xB4…21', '0.42 ETH'],
  ];
  return (
    <div style={{marginTop: 30, borderTop: `1px solid ${C.rule}`}}>
      {rows.map(([left, right], index) => (
        <div
          key={left}
          style={{
            ...enter(frame, start + index * 8, 8),
            display: 'flex',
            justifyContent: 'space-between',
            padding: index === 0 ? '11px 0' : '18px 0',
            borderBottom: `1px solid ${C.rule}`,
            color: index === 0 ? C.muted : C.ink,
            fontFamily: mono,
            fontSize: index === 0 ? 11 : 18,
          }}
        >
          <span>{left}</span>
          <strong>{right}</strong>
        </div>
      ))}
    </div>
  );
};

export const ButtonPair = ({x, y, start, confirmed}: {x: number; y: number; start: number; confirmed: number}) => {
  const frame = useCurrentFrame();
  const press = smooth(frame, confirmed, 10);
  return (
    <div style={{...enter(frame, start), position: 'absolute', left: x, top: y, display: 'flex', gap: 22}}>
      {[0, 1].map((button) => (
        <div
          key={button}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: `3px solid ${C.ink}`,
            background: press > 0.45 ? C.green : C.paper,
            transform: `scale(${1 - press * 0.08})`,
          }}
        />
      ))}
    </div>
  );
};
