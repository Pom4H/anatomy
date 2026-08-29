---
title: "How to Build a Secure Hardware Wallet — One Attack Surface at a Time"
seoTitle: "How to Build a Secure Hardware Wallet: Trust Boundaries, Secure Boot, and Key Isolation"
description: "Start with an unsafe signer and harden it step by step: trusted review, key isolation, secure storage, verified boot, rollback defense, and anti-exfil."
publishedAt: 2026-08-29
updatedAt: 2026-08-29
author: "Roman Popov"
readingMinutes: 22
wordCount: 3336
issue: 2
category: "Wallet security"
level: "Embedded systems → hardware security"
learningObjectives:
  - "Turn a vague promise such as 'the key never leaves the device' into explicit trust boundaries and testable security invariants"
  - "Explain why a hardware wallet must distrust the host, parse the operation itself, and bind the exact reviewed transaction to the signature"
  - "Separate transport code, trusted UI, secret-bearing execution, and hardware security roots so a compromise does not collapse every boundary"
  - "Design seed storage, PIN retry policy, zeroization, secure boot, firmware update, anti-rollback, and production debug locking as one system"
  - "Explain why a secure element that can sign secp256k1 is not automatically a complete BIP-32 hardware wallet"
  - "Recognize signature exfiltration as a separate threat and know when an anti-exfil protocol is required"
  - "Match every production security claim to the evidence needed to justify it"
tags:
  - "hardware wallet"
  - "hardware security"
  - "TrustZone"
  - "secure element"
  - "secure boot"
  - "BIP-32"
  - "PSBT"
  - "anti-klepto"
  - "threat model"
repository: "https://github.com/Pom4H/hardware-wallet"
sourceCommit: "7bb963ca37a5851d24976b49b53eb369ae1db981"
socialImage: "og/hardware-wallet.png"
draft: false
---

Assume the laptop is already infected.

Not theoretically infected. Not “maybe there is a malicious browser extension.” Assume an attacker controls the companion application, can send arbitrary USB packets, can replace transaction metadata, and can lie about every address and amount shown on the computer screen.

Can the hardware wallet still protect the money?

That is the useful starting point, because a hardware wallet exists precisely to remain useful when the general-purpose computer around it is not trustworthy.

The design problem is therefore not “where do we store a private key?”

It is:

> **How do we preserve a chain of meaning from hostile bytes to a human decision to one exact cryptographic effect, while exposing as little secret material as possible?**

This lesson builds that system by starting with the insecure version and removing one attack surface at a time.

<figure class="loop-figure">
  <picture>
    <img src="/anatomy/figures/secure-wallet-ladder.svg" alt="A sequence of hardware-wallet designs that progressively add a semantic transaction boundary, trusted review, isolated secure execution, a hardware security root, and verified boot." width="960" height="540" loading="eager" decoding="async" />
  </picture>
  <figcaption>
    <strong>Build-up</strong>
    <span>Each stage removes a specific class of attacks. No single chip turns an unsafe design into a safe wallet.</span>
    <span class="loop-figure__duration">attack surface ↓</span>
  </figcaption>
</figure>

<div class="key-idea">
  <span>Core idea</span>
  <p><strong>A secure hardware wallet is a composition of boundaries. If one component can silently reinterpret the user's intent, bypass authorization, boot old firmware, or export a secret, the strongest chip elsewhere in the device cannot repair that broken chain.</strong></p>
</div>

## Stage 0: the software signer

The simplest wallet looks like this:

```text
host application
      ↓
seed / private key in process memory
      ↓
sign(transaction)
      ↓
broadcast
```

This is a perfectly reasonable software wallet architecture. But it does not survive the threat model we just chose.

If malware can read the process memory, the attacker can copy the seed. If malware can replace the transaction before signing, it can send money elsewhere. If the user only sees the transaction on the same compromised computer, there is no independent source of truth.

Moving that exact program onto a small MCU does not automatically fix the model:

```text
USB request
    ↓
MCU parser
    ↓
MCU RAM: seed / child private key
    ↓
MCU signer
```

Now the computer cannot directly read normal MCU RAM, which is already useful. But a firmware bug, debug path, memory disclosure, DMA-capable peripheral, malicious update, or physical attack may still expose the same key.

The first upgrade is therefore not a secure element.

It is to decide **what the host is allowed to ask for**.

## Stage 1: never expose `sign(hash)` as the product boundary

A host-facing API such as this is dangerously weak:

```text
sign(0x72f9...e418)
```

The hardware wallet has no semantic idea what the digest means. It may represent the transaction currently shown by the companion app. It may represent a different transaction. The device cannot tell.

For Bitcoin, a better boundary is a structured signing request such as a [Partially Signed Bitcoin Transaction (BIP-174)](https://bips.dev/174/):

```text
sign_bitcoin_transaction(psbt)
```

The device still treats the PSBT as hostile input. But now it has enough information to independently derive the operation it is being asked to authorize.

The important ownership split becomes:

```text
HOST
discover UTXOs
estimate fee
construct proposal
broadcast result

DEVICE
parse proposal
validate supported subset
derive signing payload
render review
collect approval
sign
```

BIP-174 explicitly includes the signer as one of its roles and was designed to support workflows such as offline signers and hardware wallets. That does not make every PSBT safe by itself. It gives the device a structured object it can inspect instead of an opaque digest.

The product rule is stronger than “we support PSBT”:

> The signer must derive its cryptographic payload from the **same parsed object** that produced the human review.

No second host-provided digest. No hidden parallel representation.

## Stage 2: what you see must be what you sign

A compromised host can still lie beautifully.

It can render:

```text
Send 0.01 BTC to Alice
```

while sending the hardware wallet a transaction that pays Mallory.

So the hardware wallet must own a display that belongs to the trusted path.

```text
host PSBT
   ↓
device parser
   ↓
normalized transaction
   ├──────────────► trusted display
   │                 0.01 BTC
   │                 bc1q...
   │                 fee ...
   │
   └──────────────► sighash
```

The screen does not display a label supplied by the host. It displays fields derived from the transaction the device itself parsed.

Then physical input must authorize the object currently under review.

<figure class="loop-figure">
  <picture>
    <img src="/anatomy/figures/secure-wallet-signing-path.svg" alt="An untrusted PSBT enters a trusted parser. The same parsed transaction feeds both the trusted display and the sighash computation, and a physical confirmation gates the signer." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>One object</strong>
    <span>The trusted review and the signing payload are two projections of the same parsed transaction.</span>
    <span class="loop-figure__duration">review = sign</span>
  </figcaption>
</figure>

That is why physical controls are security controls, not merely UI.

A useful input grammar makes accidental approval structurally difficult. In the reference two-button design:

```text
Left          = previous / decrease
Right         = next / increase
Left + Right  = enter / confirm
```

A single navigation button never means “approve.”

<div class="checkpoint">
  <span>Checkpoint 01</span>
  <p>A secure element can keep a private key perfectly secret and still authorize theft if compromised code can feed it an operation the user never reviewed. Trusted review protects intent; key isolation protects the secret. A production wallet needs both.</p>
</div>

## Stage 3: split the MCU into worlds

We now have security-critical firmware, but it is still sitting beside USB parsing, transport state, update downloads, and other large attack surfaces.

That is too much code inside one privilege boundary.

A Cortex-M33 with Arm TrustZone-M gives one possible hardware mechanism for dividing the MCU into Secure and Non-secure worlds. The exact MCU is not selected by this lesson, but an STM32U5-class part illustrates the capability: ST documents TrustZone-aware memory, GPIO, tamper, flash and peripheral security controls in the [STM32U5 family documentation](https://www.st.com/en/microcontrollers-microprocessors/stm32u5-series/documentation.html).

A reasonable split is:

```text
NON-SECURE
USB / BLE
packet framing
host session transport
update download
non-sensitive diagnostics

SECURE
transaction parser
policy
wallet authorization
trusted display
confirmation GPIO
root-store interface
key lifecycle
signing service
```

The point is not that “TrustZone = secure.”

The point is **least privilege**.

A bug in USB enumeration should not automatically get a pointer to seed memory. A malformed transport packet should cross a narrow validated call boundary before it reaches any secret-bearing service.

The display and confirmation input are easy to overlook. If the trusted parser runs in the Secure world but an untrusted world can rewrite the display controller or synthesize the button event, the security story is still broken.

The review path, display ownership, and authorization GPIOs belong to the same boundary.

## Stage 4: add a hardware security root

Now we can introduce a dedicated secure element.

But “put the seed in a secure element” is not a complete design. First decide what the secure element actually owns.

A practical first-generation architecture may use it for:

- a device-unique hardware secret;
- authenticated key wrapping;
- durable PIN retry counters;
- monotonic security counters;
- attestation or device identity;
- high-quality hardware randomness;
- protected objects that ordinary MCU firmware cannot read.

The MCU can then store only authenticated ciphertext:

```text
MCU flash:
nonce
ciphertext(seed/root)
authentication tag

secure element:
hardware secret
authorization state
retry counter
```

Unlocking reconstructs a key-encryption capability only inside the trusted path. The ciphertext in external or MCU flash is not sufficient by itself.

A stronger architecture pushes actual private-key derivation and signing below the MCU boundary:

```text
trusted MCU                  secure signer
    │
    │ derive(path)
    ├──────────────────────► private key stays here
    │
    │ sign(transaction data)
    ├──────────────────────► signature
    │◄──────────────────────
```

That can support the much stronger claim:

> A private key never enters MCU RAM.

But that sentence is valid only if **all sensitive intermediates needed for the wallet key hierarchy** stay inside the lower boundary.

And that leads to one of the most common design traps.

## The BIP-32 trap: secp256k1 signing is not an HD wallet

Bitcoin wallets normally use hierarchical deterministic key derivation. [BIP-32](https://bips.dev/32/) derives a tree of extended keys from root material:

```text
seed
 ↓
master private key + chain code
 ↓
account
 ↓
change / receive
 ↓
address index
```

Imagine a secure element that can store one `secp256k1` private key and perform ECDSA.

That sounds perfect for Bitcoin.

But ask the next question:

**Where does BIP-32 child derivation happen?**

If firmware has to export an extended private key, chain code, or child scalar into MCU RAM to implement the hierarchy, then “ECDSA happens in the secure element” did not produce “Bitcoin private keys never leave the secure element.”

The hardware gate must test the complete lifecycle:

```text
entropy
→ root installation
→ wallet context
→ BIP-32 derivation
→ public-key derivation
→ ECDSA/Schnorr operation
→ wipe / lock
```

not one vendor demo called `Sign()`.

This is also why the exact secure element in the reference project is intentionally not frozen yet. Curve support is one checkbox. The wallet requires a **protocol-compatible secret lifecycle**.

## Stage 5: make PIN attempts a hardware property

A PIN stored as an application variable is not a serious brute-force boundary.

Bad:

```text
failed_attempts = 4

reboot

failed_attempts = 0
```

The retry count has to survive reset, interrupted writes, brownouts, and an attacker trying to modify ordinary firmware state.

The current software model already treats PIN retry accounting as a durable backend responsibility. Production hardware should move that primitive as low as practical: protected monotonic storage or a secure-element policy that ordinary transport firmware cannot reset.

The order also matters.

A failed attempt should be durable **before** the reducer is told about the new count. A successful verification should durably reset the counter before the session becomes unlocked.

```text
verify PIN
   ↓
commit retry result
   ↓
only then
   ↓
open or reject session
```

That sequencing turns power failure from a potential bypass into an ordinary error case.

## Stage 6: secure boot is part of key storage

Suppose the seed is perfectly wrapped and the PIN counter is inside a secure element.

Now install an old firmware version that contains a bug allowing arbitrary secure-service calls.

The attacker may never need to “extract the seed.” They can simply ask the vulnerable firmware to misuse it.

The boot path is therefore part of the wallet's key-isolation story:

```text
immutable ROM / silicon root
        ↓ verifies
first-stage boot
        ↓ verifies
update-capable bootloader
        ↓ verifies
application firmware
```

Verification alone is insufficient. The device also needs an **anti-rollback floor**.

If version 17 fixed a signing-policy vulnerability, version 3 must not become bootable just because it still has a historically valid signature.

A production update design needs:

- signed firmware images;
- authenticated version metadata;
- monotonic security version;
- rollback-safe A/B slots or equivalent interrupted-update recovery;
- fail-closed verification;
- no unsigned convenience path hidden behind a button combination.

Development hardware and production hardware should deliberately differ.

On a development board:

```text
SWD/JTAG = available
diagnostics = verbose
reflash = convenient
```

On a production unit:

```text
debug/readout = locked or strongly authenticated
unsigned boot = impossible
security floor = durable
```

Treat production provisioning as a manufacturing security protocol, not a compiler flag.

## Stage 7: reduce the lifetime of secrets in RAM

Even inside a trusted MCU world, secret memory should have a short lifetime.

A typical software-backed derivation path creates temporary values:

```text
root
seed
chain code
child scalar
signing key
nonce material
```

Every extra lifetime is another observation window.

After use, secret-bearing buffers need explicit zeroization with a primitive the compiler cannot optimize away. The same cleanup should occur when authorization becomes invalid:

```text
sign complete
lock
session timeout
fatal error
firmware-update entry
relevant tamper event
factory wipe
```

A memory-canary test can make this concrete. Fill test secret buffers with recognizable bytes, execute every lifecycle path, and scan the modeled memory afterward.

That proves something useful:

> these bytes are absent from the memory model after this transition.

It does **not** prove:

> a physical attacker cannot recover them from silicon.

Voltage glitching, EM/power side channels, bus probing, debug bypass, remanence, and invasive extraction are different evidence classes.

<div class="proof-boundary">
  <p>Security claims must stop where the evidence stops.</p>
  <code>emulator RAM scan ≠ fault-injection resistance ≠ invasive silicon resistance</code>
</div>

## Stage 8: the signer itself can leak the key

There is a stranger attack.

Imagine malicious signing firmware that never returns the private key. Every signature verifies correctly. The displayed transaction is even correct.

The firmware can still try to encode secret bits into choices it controls while generating signatures.

For ECDSA, the nonce is a natural covert channel.

```text
valid signature #1 ─┐
valid signature #2 ─┼─► attacker observes chosen nonces indirectly
valid signature #3 ─┘
                         ↓
                   secret information leaks
```

This is not solved by air-gapping the wallet. It is a problem **inside the signer**.

BitBox documents an anti-klepto protocol for secp256k1 ECDSA in which the hardware signer commits to its nonce contribution and host-provided randomness participates in the final nonce. The goal is to remove the signer's freedom to choose an arbitrary final nonce as a secret channel. See the [BitBox anti-klepto explanation](https://blog.bitbox.swiss/en/anti-klepto-explained-protection-against-leaking-private-keys/) and [threat model](https://bitbox.swiss/bitbox02/threat-model/).

The qualifier matters: this protection is signature-scheme specific. It should not be generalized to Schnorr/Taproot merely because both use `secp256k1`. [BIP-340](https://bips.dev/340/) is a different signing scheme and needs its own exfiltration analysis.

## The resulting architecture

After all those steps, the diagram finally earns the word “hardware wallet.”

<figure class="loop-figure">
  <picture>
    <img src="/anatomy/figures/secure-wallet-boundaries.svg" alt="A final hardware-wallet architecture with an untrusted host, a non-secure transport world, a trusted MCU world that owns parsing display and physical approval, and a secure element below it for protected secrets and counters." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Final boundary</strong>
    <span>The host proposes. Non-secure code transports. Trusted code interprets and authorizes. The hardware security root protects the secrets and durable security state.</span>
    <span class="loop-figure__duration">four trust zones</span>
  </figcaption>
</figure>

The reference direction is intentionally a **class of architecture**, not a frozen bill of materials:

| Layer | Required property | Candidate implementation class |
| --- | --- | --- |
| Host | Fully untrusted | desktop/mobile/browser wallet |
| Transport | Cannot access secret buffers | non-secure MCU world |
| Trusted execution | Owns parser, review, approval and secret lifecycle | Cortex-M33 secure world / equivalent isolation |
| Trusted UI | Host cannot rewrite review or synthesize approval | secure display path + secure GPIO ownership |
| Root protection | Hardware-bound secret and durable policy | dedicated secure element / security controller |
| Boot | Only approved security versions execute | ROM root + signed boot + anti-rollback |
| Storage | Flash disclosure alone is insufficient | authenticated wrapped root or secure-signer storage |
| Signatures | No unnecessary secret export or covert channel | isolated signer + algorithm-specific anti-exfil where available |

A real part is accepted only after it satisfies these contracts.

This is more disciplined than choosing “the most secure MCU” first and designing the wallet around whatever APIs it happens to expose.

## What should live where?

For a practical open reference device, the boundary could look like this:

<dl class="os-state-map">
  <dt>Untrusted host</dt>
  <dd>Network access, UTXO discovery, fee estimation, transaction construction, broadcast, portfolio UI.</dd>

  <dt>Non-secure world</dt>
  <dd>USB/BLE transport, framing, reconnect logic, update download, non-sensitive diagnostics.</dd>

  <dt>Trusted MCU world</dt>
  <dd>Fail-closed parser, supported-transaction policy, human review, display ownership, confirmation input, wallet context and secure-service orchestration.</dd>

  <dt>Secure element</dt>
  <dd>Device secret, protected counters, authenticated key wrapping, attestation, entropy contribution and private-key operations only when the complete wallet lifecycle can remain inside the boundary.</dd>
</dl>

Notice the last sentence.

A secure element is allowed to do **less** than signing if doing more would force awkward or unreviewable key movement. A first hardware generation can honestly claim:

> Private keys may briefly exist in Secure-world SRAM, but never in Non-secure RAM, USB/BLE code, or the host.

A later architecture may prove the stronger property:

> Private keys never leave the secure signer at all.

Those are different products with different evidence.

Neither should borrow the other's marketing sentence.

## Turn the design into invariants

The useful outcome of a threat model is not a diagram. It is a list of properties CI and hardware tests can try to break.

The reference project now treats these as production targets:

1. host software is always untrusted;
2. recovery material never crosses normal transport;
3. private keys never enter non-secure RAM;
4. the external protocol has no generic arbitrary-digest signing capability;
5. the trusted parser owns both review and signing payload derivation;
6. physical confirmation belongs to the trusted boundary;
7. unsupported operation classes fail closed;
8. PIN retry state is durable and monotonic;
9. firmware below the security floor cannot boot;
10. production debug policy cannot be bypassed by normal application code;
11. secret buffers are zeroized when their authorization lifetime ends;
12. one compromised security component should not automatically reveal the wallet root where the design can avoid that dependency;
13. signature generation is analyzed for secret-exfiltration channels;
14. every security claim has an evidence gate.

That final invariant prevents a subtle engineering failure: claiming a hardware property because the software architecture “looks like” it should have one.

## Evidence is part of the architecture

The project can already test many software properties:

```text
host request
→ parse
→ Review
→ physical-confirmation event
→ ChainExecution
→ signature
```

It can test stale callbacks, lock/reboot behavior, durable commit protocols, unsupported transaction rejection, and secret canaries in modeled memory.

Hardware adds new proof obligations.

| Security claim | Evidence that can justify it |
| --- | --- |
| Host cannot choose an independent digest | parser/review/execution tests from one raw object |
| PIN attempts cannot reset on reboot | forced reset and power-loss tests against durable backend |
| Key never enters non-secure RAM | memory instrumentation on every derive/sign/error path |
| Key never enters MCU RAM | concrete secure-signer implementation plus bus/memory evidence |
| Old vulnerable firmware cannot boot | anti-rollback tests on selected silicon |
| Debug cannot dump secrets | production-provisioned device test and manufacturing policy |
| Tamper causes durable wipe | hardware-in-the-loop fault/tamper tests |
| Side-channel resistance | dedicated board/silicon evaluation |

This is the difference between a diagram and a security argument.

## How the open-source reference maps to this design

`Pom4H/hardware-wallet` is intentionally ahead on architecture and behind on hardware claims.

Today it already separates:

```text
wallet-core
    deterministic lifecycle / auth / authorization

key-lifecycle
    entropy / BIP-39 / root-store contracts / zeroizing contexts

chain adapters
    parse / review / execution rules

crypto runtime
    interchangeable signing backends

firmware budget
    actual Cortex-M linked memory class
```

The measured software currently points to a practical floor around a Cortex-M-class device with at least 1 MiB Flash and 128 KiB RAM for the rollback-safe production profile. The MCU requirements already prefer TrustZone-M, dual-bank flash, secure key storage, MPU, ROM secure boot, hardware crypto and production debug lock.

But the repository still says something more important than any feature list:

**Do not use it to protect real funds yet.**

The updated [`docs/SECURITY.md`](https://github.com/Pom4H/hardware-wallet/blob/main/docs/SECURITY.md) now records the production invariants and the evidence required before stronger claims become true.

That document is the contract the eventual PCB has to satisfy.

## The final mental model

A hardware wallet is not a private key in a stronger box.

It is a sequence of authorities:

```text
HOST
may propose

TRANSPORT
may carry

PARSER
may interpret

DISPLAY
may explain

HUMAN
may authorize

SIGNER
may produce one permitted cryptographic effect
```

No layer should inherit more authority than it needs.

And no layer should be able to silently impersonate the layer above it.

<div class="checkpoint">
  <span>Checkpoint 02</span>
  <p>The strongest useful security claim is not “our chip is secure.” It is a sentence with a boundary and evidence: <strong>even if X is compromised, Y remains impossible because Z independently enforces the rule.</strong></p>
</div>

That gives us a concrete production question for every future hardware decision:

```text
What new authority does this component receive?

What happens if it is compromised?

Which other boundary still stops theft?

What test proves that?
```

If those four questions have precise answers, the design is becoming auditable.

If the answer is only “the private key never leaves,” we still have work to do.
