import {interpolate, useCurrentFrame} from 'remotion';
import {
  Boundary,
  Box,
  C,
  clamp,
  fade,
  FlowLine,
  KeyGlyph,
  LedgerRows,
  mono,
  MovingPacket,
  Packet,
  SceneShell,
  smooth,
  Tag,
} from './primitives';

export const MentalModelScene = () => {
  const frame = useCurrentFrame();
  const movement = smooth(frame, 72, 84);
  const assetX = interpolate(movement, [0, 1], [1135, 440]);
  const assetY = interpolate(movement, [0, 1], [455, 440]);
  const assetOpacity = interpolate(frame, [18, 30], [0, 1], clamp);
  const authorityOpacity = fade(frame, 164, 12);

  return (
    <SceneShell id="mental-model">
      <Box x={105} y={270} width={665} height={390} label="Blockchain ledger" detail="shared state" start={8}>
        <LedgerRows start={28} />
      </Box>
      <Box x={965} y={300} width={430} height={330} label="Wallet" detail="local authority" start={16}>
        <div
          style={{
            position: 'absolute',
            left: 30,
            right: 30,
            bottom: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            opacity: authorityOpacity,
          }}
        >
          {[
            ['KEY', C.redSoft, C.red],
            ['ADDRESS', C.blueSoft, C.blue],
            ['SIGN', C.greenSoft, C.green],
          ].map(([label, background, color]) => (
            <div
              key={label}
              style={{
                padding: '18px 8px',
                border: `1.5px solid ${color}`,
                background,
                color,
                fontFamily: mono,
                fontSize: 13,
                fontWeight: 800,
                textAlign: 'center',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </Box>

      <Packet
        x={assetX}
        y={assetY}
        label="2 ETH"
        color={C.amber}
        background={C.amberSoft}
        width={150}
        opacity={assetOpacity}
        scale={1 + Math.sin(movement * Math.PI) * 0.08}
      />
      <FlowLine from={[930, 455]} to={[790, 455]} start={72} duration={36} color={C.amber} />
      <Tag x={1000} y={650} label="controls authorization" start={164} color={C.red} background={C.redSoft} />
      <Tag x={246} y={680} label="records assets" start={150} color={C.amber} background={C.amberSoft} />
    </SceneShell>
  );
};

export const KeysScene = () => {
  const frame = useCurrentFrame();
  const signatureOpacity = fade(frame, 245, 12);
  return (
    <SceneShell id="keys">
      <Boundary x={72} y={245} width={350} height={260} label="Secret boundary" start={6} color={C.red} fill={C.redSoft} />
      <KeyGlyph x={185} y={315} start={18} />
      <Tag x={152} y={415} label="private key" start={28} color={C.red} background={C.white} />

      <Box x={585} y={270} width={285} height={150} label="Public key" detail="shareable" start={62} accent={C.blue} fill={C.blueSoft} />
      <Box x={1115} y={270} width={300} height={150} label="Address" detail="destination" start={118} accent={C.blue} fill={C.white} />
      <FlowLine from={[422, 350]} to={[585, 350]} start={54} duration={40} color={C.blue} label="derive" />
      <FlowLine from={[870, 350]} to={[1115, 350]} start={108} duration={40} color={C.blue} label="encode" />

      <Packet x={590} y={595} label="UNSIGNED TRANSACTION" start={168} color={C.blue} background={C.blueSoft} width={265} />
      <FlowLine from={[420, 445]} to={[760, 570]} start={190} duration={44} color={C.red} label="sign" />
      <Box x={960} y={520} width={350} height={150} label="Signature" detail="verifiable" start={242} accent={C.green} fill={C.greenSoft}>
        <div
          style={{
            marginTop: 25,
            opacity: signatureOpacity,
            color: C.green,
            fontFamily: mono,
            fontSize: 20,
            letterSpacing: '0.08em',
          }}
        >
          3045 0221 … 9F2A
        </div>
      </Box>
      <FlowLine from={[725, 595]} to={[960, 595]} start={232} duration={38} color={C.green} />
      <Tag x={138} y={550} label="never sent to the network" start={285} color={C.red} background={C.paper} />
    </SceneShell>
  );
};

export const SoftwareWalletScene = () => {
  const frame = useCurrentFrame();
  const signProgress = smooth(frame, 278, 30);
  const boundaryPulse = interpolate(frame, [365, 390, 430], [0, 1, 0.45], clamp);
  return (
    <SceneShell id="software-wallet">
      <Boundary
        x={76}
        y={235}
        width={1190}
        height={460}
        label="Phone or computer · one compromise domain"
        start={8}
        color={boundaryPulse > 0.6 ? C.red : C.ink}
        fill="rgba(255,253,248,.7)"
      />
      <Box x={135} y={315} width={235} height={165} label="Wallet UI" detail="review" start={24} accent={C.amber} fill={C.amberSoft}>
        <div style={{marginTop: 24, fontFamily: mono, fontSize: 14, lineHeight: 1.55}}>
          SEND 0.25 ETH<br />TO 0x71…9A
        </div>
      </Box>
      <Box x={445} y={315} width={245} height={165} label="Transaction builder" detail="prepare" start={54} accent={C.blue} fill={C.blueSoft} />
      <Box x={770} y={315} width={230} height={165} label="Signer" detail="execute" start={88} accent={C.green} fill={C.greenSoft} />
      <Box x={790} y={535} width={190} height={105} label="Private key" detail="local" start={114} accent={C.red} fill={C.redSoft} />
      <Box x={1330} y={335} width={205} height={145} label="Network" detail="broadcast" start={132} accent={C.ink} fill={C.paperDeep} />

      <FlowLine from={[370, 397]} to={[445, 397]} start={105} duration={22} color={C.blue} />
      <MovingPacket from={[565, 515]} to={[875, 515]} label="UNSIGNED" start={165} duration={88} width={170} />
      <FlowLine from={[885, 535]} to={[885, 480]} start={246} duration={24} color={C.red} label="unlock" />
      <Packet
        x={875}
        y={515}
        label={signProgress < 0.52 ? 'UNSIGNED' : 'SIGNED'}
        color={signProgress < 0.52 ? C.blue : C.green}
        background={signProgress < 0.52 ? C.blueSoft : C.greenSoft}
        width={170}
        opacity={fade(frame, 238, 8)}
        scale={1 + Math.sin(signProgress * Math.PI) * 0.09}
      />
      <MovingPacket
        from={[1000, 397]}
        to={[1330, 397]}
        label="SIGNED TX"
        start={320}
        duration={70}
        color={C.green}
        background={C.greenSoft}
        width={185}
        hold
      />
      <FlowLine from={[1000, 397]} to={[1330, 397]} start={310} duration={54} color={C.green} />
      <Tag
        x={435}
        y={710}
        label="UI + approval + key access share one operating system"
        start={368}
        color={C.red}
        background={C.redSoft}
      />
    </SceneShell>
  );
};
