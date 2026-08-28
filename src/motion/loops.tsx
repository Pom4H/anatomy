import type {CSSProperties, ReactNode} from 'react';
import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {
  paper: '#f4f0e8',
  paperDeep: '#e7e0d4',
  ink: '#171713',
  muted: '#6f6a61',
  rule: '#b8b0a3',
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

const sans = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const mono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = (frame: number, from: number, to: number): number =>
  interpolate(frame, [from, to], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });

const fadeWindow = (
  frame: number,
  fadeInStart: number,
  fadeInEnd: number,
  fadeOutStart: number,
  fadeOutEnd: number,
): number => ease(frame, fadeInStart, fadeInEnd) * (1 - ease(frame, fadeOutStart, fadeOutEnd));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const Box = ({
  x,
  y,
  width,
  height,
  title,
  detail,
  accent = C.ink,
  fill = C.white,
  opacity = 1,
  style,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  detail?: string;
  accent?: string;
  fill?: string;
  opacity?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
      padding: '18px 20px',
      border: `2px solid ${accent}`,
      background: fill,
      opacity,
      fontFamily: sans,
      ...style,
    }}
  >
    <div style={{fontSize: 24, fontWeight: 760, letterSpacing: -0.8}}>{title}</div>
    {detail ? (
      <div style={{marginTop: 8, color: C.muted, fontSize: 16, lineHeight: 1.3}}>{detail}</div>
    ) : null}
  </div>
);

const Label = ({
  x,
  y,
  children,
  color = C.muted,
  size = 15,
  weight = 600,
  opacity = 1,
  monoText = false,
  align = 'left',
}: {
  x: number;
  y: number;
  children: ReactNode;
  color?: string;
  size?: number;
  weight?: number;
  opacity?: number;
  monoText?: boolean;
  align?: CSSProperties['textAlign'];
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      color,
      fontFamily: monoText ? mono : sans,
      fontSize: size,
      fontWeight: weight,
      opacity,
      textAlign: align,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

const Line = ({
  x1,
  y1,
  x2,
  y2,
  progress = 1,
  color = C.ink,
  width = 3,
  dashed = false,
  opacity = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress?: number;
  color?: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
}) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const tipX = lerp(x1, x2, progress);
  const tipY = lerp(y1, y2, progress);
  const head = 10;
  const leftX = tipX - Math.cos(angle - Math.PI / 6) * head;
  const leftY = tipY - Math.sin(angle - Math.PI / 6) * head;
  const rightX = tipX - Math.cos(angle + Math.PI / 6) * head;
  const rightY = tipY - Math.sin(angle + Math.PI / 6) * head;

  return (
    <svg
      width="960"
      height="540"
      viewBox="0 0 960 540"
      style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? '8 8' : length}
        strokeDashoffset={dashed ? 0 : length * (1 - progress)}
        strokeLinecap="square"
      />
      {progress > 0.96 ? (
        <polygon points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`} fill={color} />
      ) : null}
    </svg>
  );
};

const Token = ({
  x,
  y,
  label,
  color,
  fill,
  opacity = 1,
  width = 150,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  fill: string;
  opacity?: number;
  width?: number;
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - width / 2,
      top: y - 22,
      width,
      height: 44,
      display: 'grid',
      placeItems: 'center',
      color,
      background: fill,
      border: `2px solid ${color}`,
      fontFamily: mono,
      fontSize: 14,
      fontWeight: 800,
      letterSpacing: 0.7,
      opacity,
    }}
  >
    {label}
  </div>
);

const Canvas = ({
  index,
  title,
  footer,
  children,
}: {
  index: string;
  title: string;
  footer: string;
  children: ReactNode;
}) => (
  <AbsoluteFill style={{background: C.paper, color: C.ink, fontFamily: sans, overflow: 'hidden'}}>
    <div
      style={{
        position: 'absolute',
        left: 42,
        right: 42,
        top: 28,
        display: 'flex',
        alignItems: 'baseline',
        gap: 18,
      }}
    >
      <span style={{color: C.red, fontFamily: mono, fontSize: 14, fontWeight: 800}}>{index}</span>
      <h1 style={{margin: 0, fontSize: 36, lineHeight: 1, letterSpacing: -1.8, fontWeight: 790}}>{title}</h1>
    </div>
    <div style={{position: 'absolute', left: 42, right: 42, top: 82, height: 1, background: C.ink}} />
    {children}
    <div style={{position: 'absolute', left: 42, right: 42, bottom: 42, height: 1, background: C.ink}} />
    <div
      style={{
        position: 'absolute',
        left: 42,
        right: 42,
        bottom: 16,
        color: C.muted,
        fontFamily: mono,
        fontSize: 13,
        letterSpacing: 0.15,
      }}
    >
      {footer}
    </div>
  </AbsoluteFill>
);

const WalletLedgerLoop = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const signatureProgress = ease(frame, 18, 48);
  const signatureOpacity = fadeWindow(frame, 10, 18, durationInFrames - 18, durationInFrames - 1);
  const updateOpacity = fadeWindow(frame, 46, 56, durationInFrames - 18, durationInFrames - 1);
  const keyPulse = 1 + 0.08 * Math.sin(Math.PI * ease(frame, 4, 30));

  return (
    <Canvas
      index="LOOP 01"
      title="A wallet does not hold coins"
      footer="THE LEDGER HOLDS STATE · THE WALLET HOLDS AUTHORITY"
    >
      <Box x={70} y={150} width={280} height={210} title="WALLET" detail="private key + signing logic" accent={C.red} />
      <div
        style={{
          position: 'absolute',
          left: 145,
          top: 238,
          width: 130,
          height: 62,
          border: `2px solid ${C.red}`,
          background: C.redSoft,
          display: 'grid',
          placeItems: 'center',
          color: C.red,
          fontFamily: mono,
          fontSize: 15,
          fontWeight: 800,
          transform: `scale(${keyPulse})`,
        }}
      >
        PRIVATE KEY
      </div>

      <Box x={610} y={132} width={280} height={250} title="BLOCKCHAIN LEDGER" detail="shared state replicated by nodes" accent={C.ink} />
      <div style={{position: 'absolute', left: 642, top: 230, right: 102, borderTop: `1px solid ${C.rule}`}} />
      <Label x={642} y={250} monoText size={14}>ACCOUNT</Label>
      <Label x={796} y={250} monoText size={14}>BALANCE</Label>
      <Label x={642} y={292} size={18} weight={720}>0xA11CE</Label>
      <Label x={796} y={292} size={18} weight={720}>2.00 ETH</Label>
      <div
        style={{
          position: 'absolute',
          left: 628,
          top: 278,
          width: 232,
          height: 48,
          background: C.greenSoft,
          borderLeft: `5px solid ${C.green}`,
          opacity: updateOpacity,
        }}
      />
      <Label x={642} y={292} size={18} weight={760} color={C.green} opacity={updateOpacity}>0xA11CE</Label>
      <Label x={796} y={292} size={18} weight={760} color={C.green} opacity={updateOpacity}>1.70 ETH</Label>

      <Line x1={350} y1={255} x2={610} y2={255} progress={signatureProgress} color={C.blue} width={4} />
      <Token
        x={lerp(380, 580, signatureProgress)}
        y={255}
        label="SIGNATURE"
        color={C.blue}
        fill={C.blueSoft}
        opacity={signatureOpacity}
      />
      <Label x={420} y={198} color={C.blue} size={15} weight={760} opacity={signatureOpacity}>authorizes a state transition</Label>
    </Canvas>
  );
};

const KeySignatureLoop = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const derive = ease(frame, 10, 34);
  const address = ease(frame, 32, 54);
  const sign = ease(frame, 58, 84);
  const verify = ease(frame, 84, 104);
  const dynamicOpacity = fadeWindow(frame, 4, 12, durationInFrames - 14, durationInFrames - 1);

  return (
    <Canvas
      index="LOOP 02"
      title="Keys, addresses, and signatures are different objects"
      footer="PRIVATE KEY → PUBLIC KEY → ADDRESS · PRIVATE KEY + DATA → SIGNATURE"
    >
      <Box x={70} y={150} width={200} height={120} title="PRIVATE KEY" detail="secret" accent={C.red} fill={C.redSoft} />
      <Box x={380} y={150} width={200} height={120} title="PUBLIC KEY" detail="shareable" accent={C.blue} fill={C.blueSoft} opacity={Math.max(0.25, derive)} />
      <Box x={690} y={150} width={200} height={120} title="ADDRESS" detail="protocol identifier" accent={C.ink} opacity={Math.max(0.2, address)} />
      <Box x={220} y={340} width={230} height={110} title="TRANSACTION DATA" detail="the exact operation" accent={C.amber} fill={C.amberSoft} />
      <Box x={620} y={340} width={230} height={110} title="SIGNATURE" detail="verifiable authorization" accent={C.green} fill={C.greenSoft} opacity={Math.max(0.2, sign)} />

      <Line x1={270} y1={210} x2={380} y2={210} progress={derive} color={C.blue} width={4} opacity={dynamicOpacity} />
      <Label x={295} y={172} color={C.blue} size={13} monoText opacity={dynamicOpacity}>DERIVE</Label>
      <Line x1={580} y1={210} x2={690} y2={210} progress={address} color={C.ink} width={3} opacity={dynamicOpacity} />
      <Label x={605} y={172} size={13} monoText opacity={dynamicOpacity}>ENCODE</Label>

      <Line x1={270} y1={270} x2={325} y2={340} progress={sign} color={C.red} width={4} opacity={dynamicOpacity} />
      <Line x1={450} y1={395} x2={620} y2={395} progress={sign} color={C.green} width={4} opacity={dynamicOpacity} />
      <Token
        x={lerp(480, 590, sign)}
        y={395}
        label="SIGN"
        color={C.green}
        fill={C.greenSoft}
        opacity={dynamicOpacity * sign}
        width={92}
      />
      <Line x1={720} y1={340} x2={530} y2={270} progress={verify} color={C.blue} width={3} dashed opacity={dynamicOpacity} />
      <Label x={555} y={298} color={C.blue} size={13} monoText opacity={dynamicOpacity * verify}>VERIFY WITH PUBLIC KEY</Label>
    </Canvas>
  );
};

const RecoveryTreeLoop = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const toSeed = ease(frame, 12, 38);
  const toRoot = ease(frame, 34, 58);
  const branch = ease(frame, 54, 86);
  const leaves = ease(frame, 80, 104);
  const dynamicOpacity = fadeWindow(frame, 5, 14, durationInFrames - 16, durationInFrames - 1);

  return (
    <Canvas
      index="LOOP 03"
      title="One backup can recreate a deterministic key tree"
      footer="RECOVERY WORDS → SEED → ROOT KEY → ACCOUNTS → ADDRESSES"
    >
      <Box x={60} y={178} width={220} height={180} title="RECOVERY WORDS" detail="human-readable backup" accent={C.red} fill={C.redSoft} />
      <div style={{position: 'absolute', left: 84, top: 258, width: 170, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6}}>
        {['river', 'copper', 'glass', 'orbit', 'maple', 'quiet'].map((word) => (
          <span key={word} style={{font: `12px ${mono}`, padding: '5px 3px', borderBottom: `1px solid ${C.red}`, color: C.red}}>{word}</span>
        ))}
      </div>
      <Box x={370} y={205} width={170} height={120} title="SEED" detail="root material" accent={C.blue} fill={C.blueSoft} opacity={Math.max(0.2, toSeed)} />
      <Box x={650} y={205} width={190} height={120} title="ROOT KEY" detail="deterministic source" accent={C.ink} opacity={Math.max(0.2, toRoot)} />

      <Line x1={280} y1={268} x2={370} y2={268} progress={toSeed} color={C.blue} width={4} opacity={dynamicOpacity} />
      <Line x1={540} y1={268} x2={650} y2={268} progress={toRoot} color={C.ink} width={3} opacity={dynamicOpacity} />

      <Line x1={745} y1={325} x2={610} y2={390} progress={branch} color={C.ink} width={3} opacity={dynamicOpacity} />
      <Line x1={745} y1={325} x2={745} y2={390} progress={branch} color={C.ink} width={3} opacity={dynamicOpacity} />
      <Line x1={745} y1={325} x2={880} y2={390} progress={branch} color={C.ink} width={3} opacity={dynamicOpacity} />
      {[
        {x: 535, label: 'ACCOUNT 0'},
        {x: 670, label: 'ACCOUNT 1'},
        {x: 805, label: 'ACCOUNT 2'},
      ].map((account) => (
        <div
          key={account.label}
          style={{
            position: 'absolute',
            left: account.x,
            top: 390,
            width: 150,
            height: 48,
            display: 'grid',
            placeItems: 'center',
            border: `2px solid ${C.ink}`,
            background: C.white,
            font: `700 13px ${mono}`,
            opacity: Math.max(0.15, branch),
          }}
        >
          {account.label}
        </div>
      ))}
      {[
        {x: 570, y: 464},
        {x: 705, y: 464},
        {x: 840, y: 464},
      ].map((leaf, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: leaf.x,
            top: leaf.y,
            width: 80,
            height: 24,
            borderBottom: `4px solid ${C.green}`,
            opacity: leaves * dynamicOpacity,
          }}
        />
      ))}
      <Label x={580} y={493} color={C.green} monoText size={12} opacity={leaves * dynamicOpacity}>ADDRESSES REAPPEAR</Label>
    </Canvas>
  );
};

const SoftwareSigningLoop = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const build = ease(frame, 12, 34);
  const review = ease(frame, 32, 54);
  const sign = ease(frame, 54, 82);
  const broadcast = ease(frame, 80, 108);
  const dynamicOpacity = fadeWindow(frame, 5, 14, durationInFrames - 16, durationInFrames - 1);

  return (
    <Canvas
      index="LOOP 04"
      title="Software wallet: the whole path shares one host"
      footer="UI · TRANSACTION BUILDER · PRIVATE KEY · SIGNER · NETWORK CLIENT"
    >
      <div style={{position: 'absolute', left: 55, top: 120, width: 850, height: 340, border: `3px solid ${C.ink}`, background: C.paperDeep}} />
      <Label x={80} y={136} monoText size={14} weight={800}>PHONE / BROWSER / COMPUTER</Label>

      <Box x={90} y={205} width={180} height={120} title="BUILD" detail="unsigned data" accent={C.blue} fill={C.blueSoft} />
      <Box x={315} y={205} width={180} height={120} title="REVIEW" detail="host screen" accent={C.amber} fill={C.amberSoft} opacity={Math.max(0.25, review)} />
      <Box x={540} y={205} width={180} height={120} title="SIGN" detail="local key use" accent={C.green} fill={C.greenSoft} opacity={Math.max(0.25, sign)} />
      <Box x={765} y={205} width={105} height={120} title="SEND" detail="RPC" accent={C.ink} opacity={Math.max(0.25, broadcast)} />
      <div style={{position: 'absolute', left: 580, top: 365, width: 100, height: 52, border: `2px solid ${C.red}`, background: C.redSoft, color: C.red, display: 'grid', placeItems: 'center', font: `800 13px ${mono}`}}>PRIVATE KEY</div>
      <Line x1={270} y1={265} x2={315} y2={265} progress={build} color={C.blue} width={4} opacity={dynamicOpacity} />
      <Line x1={495} y1={265} x2={540} y2={265} progress={review} color={C.amber} width={4} opacity={dynamicOpacity} />
      <Line x1={720} y1={265} x2={765} y2={265} progress={sign} color={C.green} width={4} opacity={dynamicOpacity} />
      <Line x1={630} y1={365} x2={630} y2={325} progress={sign} color={C.red} width={4} opacity={dynamicOpacity} />
      <Token
        x={lerp(120, 830, broadcast)}
        y={355}
        label={broadcast < 0.45 ? 'UNSIGNED' : 'SIGNED'}
        color={broadcast < 0.45 ? C.blue : C.green}
        fill={broadcast < 0.45 ? C.blueSoft : C.greenSoft}
        opacity={dynamicOpacity}
        width={120}
      />
      <Label x={100} y={430} size={16} weight={720}>One compromise can potentially control both what you see and what key signs.</Label>
    </Canvas>
  );
};

const HardwareSigningLoop = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const toDevice = ease(frame, 12, 42);
  const parse = ease(frame, 40, 60);
  const review = ease(frame, 58, 82);
  const confirm = ease(frame, 80, 98);
  const sign = ease(frame, 96, 118);
  const back = ease(frame, 116, 144);
  const dynamicOpacity = fadeWindow(frame, 5, 14, durationInFrames - 18, durationInFrames - 1);

  return (
    <Canvas
      index="LOOP 05"
      title="Hardware wallet: signing crosses a trust boundary"
      footer="HOST PROPOSES · DEVICE PARSES · DEVICE DISPLAYS · HUMAN CONFIRMS · DEVICE SIGNS"
    >
      <div style={{position: 'absolute', left: 48, top: 120, width: 390, height: 350, border: `2px solid ${C.ink}`, background: C.paperDeep}} />
      <div style={{position: 'absolute', left: 522, top: 120, width: 390, height: 350, border: `4px solid ${C.red}`, background: C.white}} />
      <Label x={72} y={138} monoText size={13} weight={800}>ONLINE HOST · UNTRUSTED</Label>
      <Label x={548} y={138} monoText size={13} weight={800} color={C.red}>DEDICATED SIGNER</Label>
      <Box x={82} y={205} width={220} height={110} title="BUILD" detail="unsigned transaction" accent={C.blue} fill={C.blueSoft} />
      <Box x={550} y={185} width={150} height={95} title="PARSE" detail="actual bytes" accent={C.blue} fill={C.blueSoft} opacity={Math.max(0.2, parse)} />
      <Box x={735} y={185} width={150} height={95} title="DISPLAY" detail="trusted review" accent={C.amber} fill={C.amberSoft} opacity={Math.max(0.2, review)} />
      <Box x={550} y={330} width={150} height={95} title="CONFIRM" detail="physical input" accent={C.amber} fill={C.amberSoft} opacity={Math.max(0.2, confirm)} />
      <Box x={735} y={330} width={150} height={95} title="SIGN" detail="private key" accent={C.green} fill={C.greenSoft} opacity={Math.max(0.2, sign)} />
      <div style={{position: 'absolute', left: 770, top: 438, color: C.red, font: `800 12px ${mono}`}}>KEY NEVER ENTERS HOST</div>

      <Line x1={302} y1={260} x2={550} y2={232} progress={toDevice} color={C.blue} width={4} opacity={dynamicOpacity} />
      <Token
        x={lerp(330, 520, toDevice)}
        y={lerp(255, 232, toDevice)}
        label="UNSIGNED"
        color={C.blue}
        fill={C.blueSoft}
        opacity={dynamicOpacity}
        width={120}
      />
      <Line x1={700} y1={232} x2={735} y2={232} progress={parse} color={C.blue} width={4} opacity={dynamicOpacity} />
      <Line x1={810} y1={280} x2={625} y2={330} progress={review} color={C.amber} width={4} opacity={dynamicOpacity} />
      <Line x1={700} y1={378} x2={735} y2={378} progress={confirm} color={C.green} width={4} opacity={dynamicOpacity} />
      <Line x1={735} y1={378} x2={438} y2={365} progress={back} color={C.green} width={4} opacity={dynamicOpacity} />
      <Token
        x={lerp(705, 465, back)}
        y={lerp(378, 365, back)}
        label="SIGNED"
        color={C.green}
        fill={C.greenSoft}
        opacity={dynamicOpacity * Math.max(sign, back)}
        width={110}
      />
      <Box x={82} y={345} width={220} height={85} title="BROADCAST" detail="signed transaction" accent={C.ink} opacity={Math.max(0.2, back)} />
    </Canvas>
  );
};

const MismatchRejectedLoop = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const request = ease(frame, 10, 36);
  const reveal = ease(frame, 34, 58);
  const reject = ease(frame, 58, 82);
  const dynamicOpacity = fadeWindow(frame, 4, 12, durationInFrames - 14, durationInFrames - 1);
  const shake = reject > 0 && reject < 1 ? Math.sin(frame * 1.8) * 5 * (1 - reject) : 0;

  return (
    <Canvas
      index="LOOP 06"
      title="Trusted review catches a host/device mismatch"
      footer="VERIFY THE DESTINATION AND AMOUNT ON THE SIGNING DEVICE"
    >
      <div style={{position: 'absolute', left: 70, top: 145, width: 350, height: 260, border: `2px solid ${C.ink}`, background: C.paperDeep}} />
      <div style={{position: 'absolute', left: 540, top: 145, width: 350, height: 260, border: `4px solid ${C.red}`, background: C.white, transform: `translateX(${shake}px)`}} />
      <Label x={94} y={162} monoText size={13} weight={800}>HOST SCREEN</Label>
      <Label x={566} y={162} monoText size={13} weight={800} color={C.red}>DEVICE DISPLAY</Label>

      <div style={{position: 'absolute', left: 104, top: 220, width: 280, padding: 22, background: C.white, border: `2px solid ${C.green}`}}>
        <div style={{fontSize: 16, color: C.muted}}>Send to</div>
        <div style={{marginTop: 8, fontSize: 27, fontWeight: 780}}>BOB</div>
        <div style={{marginTop: 14, font: `800 16px ${mono}`, color: C.green}}>0.10 BTC</div>
      </div>
      <div style={{position: 'absolute', left: 574, top: 220, width: 280, padding: 22, background: C.redSoft, border: `3px solid ${C.red}`, opacity: Math.max(0.15, reveal)}}>
        <div style={{fontSize: 16, color: C.muted}}>Actual destination</div>
        <div style={{marginTop: 8, fontSize: 27, fontWeight: 780, color: C.red}}>MALLORY</div>
        <div style={{marginTop: 14, font: `800 16px ${mono}`, color: C.red}}>0.10 BTC</div>
      </div>

      <Line x1={420} y1={275} x2={540} y2={275} progress={request} color={C.blue} width={4} opacity={dynamicOpacity} />
      <Token
        x={lerp(450, 515, request)}
        y={275}
        label="RAW TX"
        color={C.blue}
        fill={C.blueSoft}
        opacity={dynamicOpacity}
        width={96}
      />
      <div
        style={{
          position: 'absolute',
          left: 635,
          top: 320,
          width: 130,
          height: 56,
          display: 'grid',
          placeItems: 'center',
          background: C.red,
          color: C.white,
          font: `900 16px ${mono}`,
          opacity: reject * dynamicOpacity,
          transform: `scale(${0.7 + reject * 0.3}) rotate(-4deg)`,
        }}
      >
        REJECT
      </div>
      <Line x1={766} y1={209} x2={661} y2={384} progress={reject} color={C.red} width={8} opacity={dynamicOpacity} />
      <Label x={257} y={440} color={C.red} size={17} weight={760} opacity={reject * dynamicOpacity}>The device stops the flow before any private-key operation.</Label>
    </Canvas>
  );
};

const LOOP_WIDTH = 960;
const LOOP_HEIGHT = 540;
const LOOP_FPS = 20;

export const loopCompositions = [
  {id: 'WalletLedgerLoop', component: WalletLedgerLoop, durationInFrames: 80},
  {id: 'KeySignatureLoop', component: KeySignatureLoop, durationInFrames: 110},
  {id: 'RecoveryTreeLoop', component: RecoveryTreeLoop, durationInFrames: 120},
  {id: 'SoftwareSigningLoop', component: SoftwareSigningLoop, durationInFrames: 130},
  {id: 'HardwareSigningLoop', component: HardwareSigningLoop, durationInFrames: 155},
  {id: 'MismatchRejectedLoop', component: MismatchRejectedLoop, durationInFrames: 105},
] as const;

export const RemotionRoot = () => (
  <>
    {loopCompositions.map((loop) => (
      <Composition
        key={loop.id}
        id={loop.id}
        component={loop.component}
        durationInFrames={loop.durationInFrames}
        fps={LOOP_FPS}
        width={LOOP_WIDTH}
        height={LOOP_HEIGHT}
      />
    ))}
  </>
);
