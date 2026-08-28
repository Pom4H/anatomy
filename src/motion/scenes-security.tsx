import {spring, useCurrentFrame} from 'remotion';
import {WALLET_VIDEO} from './wallet-model';
import {
  Boundary,
  Box,
  ButtonPair,
  C,
  enter,
  fade,
  FlowLine,
  mono,
  MovingPacket,
  Packet,
  SceneShell,
  sans,
  smooth,
  Tag,
} from './primitives';

export const HardwareWalletScene = () => {
  const frame = useCurrentFrame();
  const reviewOpacity = fade(frame, 205, 12);
  const signed = smooth(frame, 365, 32);
  return (
    <SceneShell id="hardware-wallet">
      <Boundary x={72} y={240} width={610} height={450} label="Online host · untrusted" start={8} color={C.red} fill="rgba(244,216,210,.34)" />
      <Boundary x={850} y={220} width={500} height={490} label="Hardware signer · trusted review" start={30} color={C.green} fill="rgba(217,238,223,.42)" />
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 215,
          bottom: 175,
          borderLeft: `2px dashed ${C.red}`,
          opacity: fade(frame, 40, 10),
        }}
      />
      <Tag x={703} y={188} label="USB trust boundary" start={42} color={C.red} background={C.paper} />

      <Box x={130} y={315} width={245} height={160} label="Transaction builder" detail="prepare" start={52} accent={C.blue} fill={C.blueSoft} />
      <Box x={425} y={315} width={195} height={160} label="Host app" detail="transport" start={72} accent={C.ink} fill={C.white} />
      <Box x={900} y={285} width={190} height={145} label="Parser" detail="decode" start={105} accent={C.blue} fill={C.blueSoft} />
      <Box x={1130} y={275} width={165} height={175} label="Display" detail="verify" start={170} accent={C.amber} fill={C.amberSoft}>
        <div style={{marginTop: 20, opacity: reviewOpacity, fontFamily: mono, fontSize: 12, lineHeight: 1.55}}>
          0.25 ETH<br />0x71…9A<br />FEE 0.001
        </div>
      </Box>
      <Box x={900} y={535} width={190} height={115} label="Signer" detail="execute" start={292} accent={C.green} fill={C.greenSoft} />
      <Box x={1130} y={535} width={165} height={115} label="Private key" detail="stays here" start={315} accent={C.red} fill={C.redSoft} />
      <Box x={1405} y={350} width={150} height={130} label="Network" detail="broadcast" start={470} accent={C.ink} fill={C.paperDeep} />

      <FlowLine from={[620, 395]} to={[900, 355]} start={95} duration={70} color={C.blue} label="unsigned tx" />
      <MovingPacket from={[560, 510]} to={[995, 470]} label="UNSIGNED TX" start={110} duration={92} width={210} />
      <FlowLine from={[1090, 355]} to={[1130, 355]} start={188} duration={20} color={C.amber} />
      <ButtonPair x={1040} y={458} start={230} confirmed={270} />
      <Tag x={975} y={500} label="physical approval" start={238} color={C.amber} background={C.amberSoft} />
      <FlowLine from={[1210, 535]} to={[1090, 590]} start={330} duration={26} color={C.red} label="key capability" />
      <Packet
        x={1000}
        y={470}
        label={signed < 0.55 ? 'UNSIGNED TX' : 'SIGNED TX'}
        color={signed < 0.55 ? C.blue : C.green}
        background={signed < 0.55 ? C.blueSoft : C.greenSoft}
        width={210}
        opacity={fade(frame, 340, 5)}
        scale={1 + Math.sin(signed * Math.PI) * 0.08}
      />
      <FlowLine from={[900, 590]} to={[620, 590]} start={408} duration={54} color={C.green} label="signature" />
      <MovingPacket
        from={[900, 590]}
        to={[520, 590]}
        label="SIGNATURE"
        start={420}
        duration={66}
        color={C.green}
        background={C.greenSoft}
        width={180}
      />
      <FlowLine from={[620, 430]} to={[1405, 415]} start={490} duration={62} color={C.green} label="signed tx" />
      <MovingPacket
        from={[620, 430]}
        to={[1405, 415]}
        label="SIGNED TX"
        start={505}
        duration={70}
        color={C.green}
        background={C.greenSoft}
        width={180}
        hold
      />
    </SceneShell>
  );
};

export const MismatchScene = () => {
  const frame = useCurrentFrame();
  const mismatch = fade(frame, 130, 15);
  const reject = spring({
    fps: WALLET_VIDEO.fps,
    frame: Math.max(0, frame - 235),
    config: {damping: 12, stiffness: 170, mass: 0.6},
  });
  return (
    <SceneShell id="mismatch">
      <Boundary x={82} y={245} width={600} height={370} label="Compromised host screen" start={8} color={C.red} fill="rgba(244,216,210,.35)" />
      <Boundary x={918} y={245} width={600} height={370} label="Hardware device display" start={32} color={C.green} fill="rgba(217,238,223,.4)" />

      <div style={{...enter(frame, 45), position: 'absolute', left: 145, top: 335, width: 470}}>
        <div style={{fontFamily: mono, fontSize: 13, color: C.muted, marginBottom: 20}}>HOST CLAIMS</div>
        <div style={{fontFamily: sans, fontSize: 44, fontWeight: 760, letterSpacing: '-.04em'}}>Send 0.25 ETH</div>
        <div style={{marginTop: 12, fontFamily: mono, fontSize: 22, color: C.blue}}>to Alice · 0x71…9A</div>
      </div>

      <div style={{...enter(frame, 82), position: 'absolute', left: 980, top: 335, width: 470}}>
        <div style={{fontFamily: mono, fontSize: 13, color: C.muted, marginBottom: 20}}>DEVICE DECODES</div>
        <div style={{fontFamily: sans, fontSize: 44, fontWeight: 760, letterSpacing: '-.04em', color: mismatch ? C.red : C.ink}}>
          Send 25.00 ETH
        </div>
        <div style={{marginTop: 12, fontFamily: mono, fontSize: 22, color: C.red}}>to 0xBAD…F00D</div>
      </div>

      <FlowLine from={[682, 430]} to={[918, 430]} start={100} duration={38} color={C.red} dashed label="same raw payload" />
      <div
        style={{
          position: 'absolute',
          left: 720,
          top: 300,
          width: 160,
          height: 210,
          opacity: mismatch,
          display: 'grid',
          placeItems: 'center',
          color: C.red,
          fontFamily: mono,
          fontSize: 17,
          fontWeight: 800,
          textAlign: 'center',
        }}
      >
        <div>
          AMOUNT<br />+ DESTINATION<br />DO NOT MATCH
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 606,
          top: 560,
          transform: `rotate(-7deg) scale(${reject})`,
          opacity: fade(frame, 230, 8),
          padding: '18px 32px',
          border: `8px solid ${C.red}`,
          color: C.red,
          background: C.paper,
          fontFamily: mono,
          fontSize: 54,
          fontWeight: 900,
          letterSpacing: '0.05em',
        }}
      >
        REJECTED
      </div>
      <Tag x={522} y={670} label="the device cannot verify for the human" start={300} color={C.amber} background={C.amberSoft} />
    </SceneShell>
  );
};

export const RecoveryWords = ({start}: {start: number}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, start),
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginTop: 24,
      }}
    >
      {Array.from({length: 12}).map((_, index) => (
        <div
          key={index}
          style={{
            padding: '8px 6px',
            borderBottom: `1px solid ${C.red}`,
            color: C.red,
            fontFamily: mono,
            fontSize: 10,
            textAlign: 'center',
          }}
        >
          {String(index + 1).padStart(2, '0')} ·••••
        </div>
      ))}
    </div>
  );
};

export const RecoveryScene = () => {
  return (
    <SceneShell id="recovery">
      <Box x={92} y={275} width={360} height={330} label="Recovery secret" detail="offline backup" start={8} accent={C.red} fill={C.redSoft}>
        <RecoveryWords start={24} />
      </Box>
      <Box x={650} y={340} width={250} height={190} label="Seed root" detail="deterministic" start={78} accent={C.amber} fill={C.amberSoft}>
        <div style={{marginTop: 28, fontFamily: mono, fontSize: 15, color: C.amber}}>ROOT → ACCOUNT → KEY</div>
      </Box>
      <Box x={1120} y={260} width={330} height={155} label="Replacement hardware" detail="same accounts" start={150} accent={C.green} fill={C.greenSoft} />
      <Box x={1120} y={500} width={330} height={155} label="Compatible software" detail="same accounts" start={182} accent={C.blue} fill={C.blueSoft} />

      <FlowLine from={[452, 440]} to={[650, 435]} start={58} duration={42} color={C.red} label="derive" />
      <FlowLine from={[900, 405]} to={[1120, 337]} start={132} duration={46} color={C.green} />
      <FlowLine from={[900, 475]} to={[1120, 577]} start={164} duration={46} color={C.blue} />
      <Tag x={514} y={635} label="loss of device ≠ loss of wallet" start={208} color={C.green} background={C.greenSoft} />
      <Tag x={895} y={680} label="the backup is also a complete theft target" start={230} color={C.red} background={C.redSoft} />
    </SceneShell>
  );
};

export const ComparisonFlow = ({
  x,
  y,
  hardware,
  start,
}: {
  readonly x: number;
  readonly y: number;
  readonly hardware: boolean;
  readonly start: number;
}) => {
  const frame = useCurrentFrame();
  const steps = hardware
    ? [
        {label: 'BUILD', zone: 'HOST', color: C.blue},
        {label: 'REVIEW', zone: 'DEVICE', color: C.amber},
        {label: 'SIGN', zone: 'DEVICE', color: C.green},
      ]
    : [
        {label: 'BUILD', zone: 'HOST', color: C.blue},
        {label: 'REVIEW', zone: 'HOST', color: C.amber},
        {label: 'SIGN', zone: 'HOST', color: C.green},
      ];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 610, height: 215}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12}}>
        {steps.map((step, index) => (
          <div
            key={step.label}
            style={{
              ...enter(frame, start + index * 20),
              minHeight: 110,
              padding: '19px 16px',
              borderTop: `5px solid ${step.color}`,
              borderBottom: `1px solid ${C.rule}`,
              background: C.white,
            }}
          >
            <div style={{fontFamily: mono, fontSize: 11, color: step.color, marginBottom: 20}}>{step.zone}</div>
            <strong style={{fontFamily: sans, fontSize: 24}}>{step.label}</strong>
          </div>
        ))}
      </div>
      <div
        style={{
          ...enter(frame, start + 82),
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: '155px 1fr',
          gap: 14,
          fontFamily: mono,
          fontSize: 12,
        }}
      >
        <span style={{color: C.red}}>PRIVATE KEY</span>
        <span>{hardware ? 'separate signing device' : 'same general-purpose device'}</span>
      </div>
    </div>
  );
};

export const ComparisonScene = () => {
  const frame = useCurrentFrame();
  return (
    <SceneShell id="comparison" final>
      <Boundary x={72} y={250} width={675} height={430} label="Software wallet" start={8} color={C.red} fill="rgba(244,216,210,.24)" />
      <Boundary x={853} y={250} width={675} height={430} label="Hardware wallet" start={28} color={C.green} fill="rgba(217,238,223,.27)" />
      <ComparisonFlow x={105} y={310} hardware={false} start={52} />
      <ComparisonFlow x={886} y={310} hardware start={72} />

      <div
        style={{
          ...enter(frame, 168),
          position: 'absolute',
          left: 105,
          top: 570,
          width: 610,
          display: 'grid',
          gridTemplateColumns: '150px 1fr',
          gap: 14,
          fontFamily: sans,
          fontSize: 17,
          lineHeight: 1.35,
        }}
      >
        <strong style={{color: C.red, fontFamily: mono, fontSize: 12}}>BOUNDARY</strong>
        <span>Host compromise may reach both the approval UI and the signing capability.</span>
      </div>
      <div
        style={{
          ...enter(frame, 190),
          position: 'absolute',
          left: 886,
          top: 570,
          width: 610,
          display: 'grid',
          gridTemplateColumns: '150px 1fr',
          gap: 14,
          fontFamily: sans,
          fontSize: 17,
          lineHeight: 1.35,
        }}
      >
        <strong style={{color: C.green, fontFamily: mono, fontSize: 12}}>BOUNDARY</strong>
        <span>Host prepares data; a separate display and signer verify and authorize it.</span>
      </div>
      <Tag x={586} y={700} label="recovery remains the root backup for both" start={235} color={C.amber} background={C.amberSoft} />
    </SceneShell>
  );
};
