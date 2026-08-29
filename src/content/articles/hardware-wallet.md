---
title: "Inside a Hardware Wallet: From First Boot to a Signed Transaction"
seoTitle: "How Hardware Wallets Actually Work — From First Boot to Signature"
description: "Follow a hardware wallet from blank state through PIN setup, a 24-word recovery backup, trusted transaction review, Cortex-M sleep and GPIO wake, circuit simulation, and private-key isolation."
publishedAt: 2026-08-28
updatedAt: 2026-08-29
author: "Roman Popov"
readingMinutes: 19
wordCount: 2847
issue: 1
category: "Wallet systems"
level: "Beginner → embedded systems"
learningObjectives:
  - "Explain why a hardware wallet is closer to a tiny security-focused operating system than a USB signing button"
  - "Trace first boot from a blank device through PIN creation, recovery backup, backup verification, and the dashboard"
  - "Explain why left/right navigation and a two-button confirmation chord create a cleaner security boundary"
  - "Follow an untrusted host request through parsing, trusted on-device review, physical approval, signing, broadcast, and account sync"
  - "Connect firmware state to Cortex-M WFI sleep, GPIO wake, and a state-dependent electrical load model"
  - "Distinguish 'the key never leaves the API' from stronger claims about MCU memory, secure signers, side channels, and physical extraction"
tags:
  - "hardware wallet"
  - "wallet operating system"
  - "recovery phrase"
  - "PIN code"
  - "trusted display"
  - "Cortex-M"
  - "Firmverse"
  - "NodeSpice"
repository: "https://github.com/Pom4H/hardware-wallet"
sourceCommit: "d0dfd9652913cb93318e6ae9701ba2718a97bd45"
socialImage: "og/hardware-wallet.png"
draft: false
---

Press both buttons. A moment later, a signature appears.

From the outside, that can make a hardware wallet look almost trivial: a small screen, two buttons, and a secret key somewhere inside. But the interesting part is everything that has to go right **before** the signature exists.

The device must know which wallet is active. It must be unlocked, but not merely awake. It must understand a request that came from an untrusted computer, turn opaque bytes into something a human can verify, show that interpretation on a screen the host cannot rewrite, wait for an unmistakable physical decision, and only then allow signing.

And before any of that, it has to survive first boot, PIN creation, recovery backup, power loss, sleep, wake, and reset without quietly weakening those rules.

That is why the most useful mental model is not “USB key signer.”

It is **a tiny security-focused operating system whose most important job is to preserve the meaning of approval**.

## The wallet does not hold coins. It holds authority.

Bitcoin does not move from one hardware wallet to another. Neither device contains a little vault of coins.

Balances and UTXOs live in the shared blockchain state. A wallet controls the cryptographic authority required to authorize changes to that state.

So when wallet A sends funds to wallet B, the real story is:

```text
host builds a proposal
        ↓
wallet A interprets it
        ↓
human verifies it on wallet A
        ↓
wallet A authorizes it
        ↓
host broadcasts the signed transaction
        ↓
blockchain state changes
        ↓
wallet B's host later discovers the new UTXO
```

Wallet B can be unplugged during the transfer. It does not need to “receive” anything over USB. Its address is enough for the blockchain to assign future spend authority to the corresponding key.

This distinction sounds basic, but it changes how you design the entire device. The secure boundary is not protecting “coins.” It is protecting **authority and user intent**.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/hardware-wallet.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/hardware-signing.gif" type="image/gif" />
    <img src="/anatomy/figures/hardware-wallet.svg" alt="An untrusted host proposes a transaction while a dedicated device parses, displays, confirms, and signs it." width="960" height="540" loading="eager" decoding="async" />
  </picture>
  <figcaption>
    <strong>The real boundary</strong>
    <span>The host proposes and broadcasts. The device interprets and authorizes.</span>
    <span class="loop-figure__duration">Trusted display + physical input</span>
  </figcaption>
</figure>

<div class="key-idea">
  <span>Core idea</span>
  <p><strong>A protected private key is necessary. It is not sufficient. The device must also bind that key to the exact operation the user saw and physically approved.</strong></p>
</div>

## Two buttons are enough — if their meaning is precise

A two-button wallet looks constrained until you treat the buttons as a small input language.

<div class="interaction-grammar" aria-label="Two-button wallet interaction grammar">
  <div>
    <kbd>Left</kbd>
    <strong>Previous or decrease</strong>
    <span>Move backward through menus, review pages, recovery words, or PIN digits.</span>
  </div>
  <div>
    <kbd>Right</kbd>
    <strong>Next or increase</strong>
    <span>Move forward or change the value currently being edited.</span>
  </div>
  <div>
    <kbd>Left + Right</kbd>
    <strong>Enter or confirm</strong>
    <span>A simultaneous physical chord accepts the item currently visible on the trusted screen.</span>
  </div>
</div>

The crucial rule in the reference firmware is simple:

**A single right-button press never means “approve.”**

Right means navigation. Approval requires both GPIO inputs to be high as one chord and then released.

That tiny design choice removes a whole category of ambiguity. If “next page” and “sign” share the same gesture, button bounce, timing bugs, or a stale screen can accidentally cross a security boundary. A separate physical chord gives the domain reducer an explicit `Enter` event.

The same grammar works during setup, PIN entry, settings, transaction review, and recovery verification. The device does not need a hidden browser-side UI to make it usable.

Ledger Nano devices are a useful real-world reference for this interaction model: PIN entry, a device-generated recovery backup, on-device verification, dashboard navigation, and both-button confirmation are all built around a small trusted screen and physical controls. See Ledger's explanations of [device initialization](https://www.ledger.com/academy/basic-basics/2-how-to-own-crypto/whats-a-secret-recovery-phrase), [the recovery backup](https://www.ledger.com/academy/basic-basics/ledgers-bit-of-it/ledger-nano-security-made-easy), and [physical confirmation](https://developers.ledger.com/docs/device-interaction/dmk-ts/ledgerjs/beginner/cosmos-app).

## First boot is already a security protocol

Before a transaction can be signed, the device has to become a wallet.

The executable lesson starts from a factory-blank state. No committed wallet root exists yet.

The owner then walks through:

<ol class="boot-sequence">
  <li><strong>Choose a new device</strong><span>The device starts without an active wallet generation.</span></li>
  <li><strong>Create a PIN</strong><span>Left and right choose each digit; both buttons commit it.</span></li>
  <li><strong>Confirm the PIN</strong><span>A second entry must match before setup can continue.</span></li>
  <li><strong>Create key material</strong><span>A production device would obtain cryptographically secure entropy inside its trusted boundary.</span></li>
  <li><strong>Show the 24-word backup</strong><span>The recovery phrase is rendered one word at a time on the device screen.</span></li>
  <li><strong>Verify the backup</strong><span>The user must prove that selected words were copied correctly.</span></li>
  <li><strong>Commit persistent wallet state</strong><span>Only the verified generation becomes the active wallet.</span></li>
  <li><strong>Open the dashboard</strong><span>Normal apps, settings, lock, and power behavior now become available.</span></li>
</ol>

The browser demo deliberately uses a deterministic BIP-39 fixture so CI can replay the same onboarding path exactly. It is test data, not production entropy. The production design boundary is represented separately by entropy-source, root-store, key-lifecycle, and atomic-commit interfaces.

The important invariant is stronger than “use good randomness”:

> The host must never become the owner of the hardware wallet's recovery phrase.

The words are generated and rendered inside the trusted device flow. JavaScript receives a firmware-owned display frame; it does not own the recovery state machine.

<div class="checkpoint">
  <span>Checkpoint 01</span>
  <p>The PIN protects access to this physical device. The recovery phrase recreates the wallet on another device. They solve different failure modes.</p>
</div>

## A screen is not the state machine

It is tempting to implement a device as one giant `switch(screen)`.

That works until the UI begins to carry security meaning.

The screen is only a projection of several deeper state machines:

<dl class="os-state-map">
  <dt>Persistent setup</dt>
  <dd>Factory blank, pending root, committed root, generated or restored origin, backup status, and security policy.</dd>

  <dt>Authentication</dt>
  <dd>Locked, PIN challenge, failed attempt, unlocked session, host trust, session lifetime, and forced relock.</dd>

  <dt>Navigation</dt>
  <dd>Dashboard, Bitcoin app, settings, security, display, power, about, and control center.</dd>

  <dt>Operation</dt>
  <dd>Request received, parsed, review prepared, review displayed, approved or rejected, executing, completed, and fail-closed error.</dd>

  <dt>Power</dt>
  <dd>Active, display-off, locked, Cortex-M `WFI`, GPIO wake, reset, and future brownout behavior.</dd>
</dl>

The useful part is not the number of states. It is the fact that they cannot silently substitute for one another.

```text
CPU awake        ≠ wallet unlocked
wallet unlocked  ≠ request trusted
review visible   ≠ operation approved
approved         ≠ signature completed
```

That separation is what turns the interface from a slideshow into an operating system.

## Unlocking is a domain transition, not an animation

When the device shows a PIN screen, the reducer is holding an authentication state. The UI is not allowed to skip it.

A successful unlock goes through an explicit sequence:

```text
UnlockRequested
  → resolve host trust
  → PinVerified
  → SessionOpened
  → unlocked wallet context
```

A wrong PIN does not merely paint an error message; it returns the authentication flow to a failed challenge.

The same principle matters when the device wakes from sleep. A GPIO edge may wake the Cortex-M, but it does **not** re-create an unlocked session.

<div class="proof-boundary">
  <p>Power state and authorization state are independent.</p>
  <code>GPIO wake ≠ PIN verified ≠ session opened ≠ transaction approved</code>
</div>

This one invariant eliminates a surprisingly dangerous class of “resume where you left off” bugs.

## A transaction begins as hostile input

The host application knows about the network. It discovers UTXOs, estimates fees, constructs a transaction, and eventually broadcasts a signed result.

But from the hardware wallet's point of view, the host is not a source of truth. It is a source of **proposals**.

A request only becomes meaningful after the device parses it and creates its own review.

In the Bitcoin flow, the firmware moves through several pages:

1. review introduction;
2. amount and network;
3. recipient and fee;
4. explicit Approve page;
5. explicit Reject page.

Left and right only navigate. They cannot sign.

When both buttons are pressed on the Approve page, the reducer receives `OperationConfirmed`. Only then may it emit `ExecuteOperation`.

The rejection path is equally important:

```text
Reject page
  → both buttons
  → UserRejected
  → no ExecuteOperation
```

A good security model makes the forbidden path easy to state.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/trust-boundary.svg" type="image/svg+xml" />
    <img src="/anatomy/figures/trust-boundary.svg" alt="The host request crosses into a trusted device boundary containing parsing, display, physical confirmation, and signing." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Trusted review</strong>
    <span>The human-readable review must describe the same operation that reaches the signer.</span>
    <span class="loop-figure__duration">Both buttons = authorization</span>
  </figcaption>
</figure>

The domain path is explicit:

```text
OperationRequested
  → ReviewPrepared
  → ReviewDisplayed
  → OperationConfirmed
  → ExecuteOperation
  → OperationCompleted
```

During the signing stage, physical input is ignored. When execution completes, the external interface receives a signature, not a private key.

That is necessary, but it is still not the strongest isolation claim. We will come back to that.

<div class="checkpoint">
  <span>Checkpoint 02</span>
  <p>A secure element can protect a secret and still sign the wrong transaction. The trusted parser, trusted display, and physical approval path protect the user's intent.</p>
</div>

## Now send money from wallet A to wallet B

The most useful test is not “can one device produce a signature?” It is a complete transfer between two independently represented wallets.

Wallet B goes first.

Its host asks for a receive address. The address is shown on **wallet B's own trusted display**, where the user can verify it before copying it to the sender.

Then wallet A receives a request containing:

```text
amount
recipient = wallet B address
network
fee
```

Wallet A independently renders those fields for review.

Only after the user checks the recipient and presses both buttons does wallet A produce the authorization needed for signing.

The host then broadcasts the signed transaction. The ledger state changes. Later, wallet B's host synchronizes and discovers the new UTXO.

Notice what never happened:

- wallet A never sent coins over USB to wallet B;
- wallet B did not need to be online during broadcast;
- the host never got to define what “approved” means;
- a single navigation button never triggered signing.

That full path is exercised by the browser proof instead of being represented as a decorative diagram.

## Sleep must stop the CPU, not just dim the SVG

Power management is another place where a convincing UI can lie.

A screen that says “Sleeping” proves nothing about the processor.

On Cortex-M, firmware can execute `WFI` — Wait For Interrupt. A correct emulator must preserve that architectural sleep state instead of continuing to advance guest instructions as if nothing happened.

Firmverse now exposes the relevant evidence:

```text
power.sleeping
power.sleepEntries
power.wakeCount
power.lastWakePin
```

When the wallet enters sleep, the firmware:

1. locks the session;
2. turns off the trusted display and status LED;
3. emits its final sleep frame;
4. executes `WFI`.

A rising edge on P14 or P16 then wakes the emulated Cortex-M. Firmverse records the wake source, the firmware consumes the gesture, and the UI returns to the **locked** screen.

Wake gets you a running processor.

It does not get you an unlocked wallet.

## Firmware state has an electrical consequence

Once sleep becomes real in the MCU model, the circuit model can stop pretending that every software state consumes the same power.

The NodeSpice example has separate MCU load branches:

```text
3.3 V rail ─┬─ active branch ─ ≈ 45 mA
            └─ WFI branch    ─ ≈ 0.1 mA
```

The executable stack drives three inputs into the electrical model:

- `awake=1|0` chooses active or WFI MCU load;
- `display=1|0` enables or disables the display branch;
- `signing=1|0` adds the signing workload.

That means a firmware transition has a visible effect all the way down to the simulated power network.

This is still a first-order model. It is useful for integration, rail behavior, state-dependent load, sleep/wake tests, and future brownout experiments. It is not yet a transistor-level model of a particular MCU, secure element, OLED controller, USB PHY, clock tree, or side-channel leakage.

That limitation is a feature of the lesson: **the model says exactly what it proves.**

## “The key never leaves” is an incomplete claim

At the API boundary, the rule is straightforward:

```text
private key stays inside
signature may leave
```

But that sentence leaves a harder question unanswered:

**Inside what?**

If signing material is present in ordinary MCU-addressable RAM or flash, then it may still be reachable through firmware bugs, debug interfaces, DMA-capable peripherals, memory disclosure, or physical attacks.

The current engineering stack therefore distinguishes two architectures.

The software-backed teaching path is allowed to demonstrate lifecycle, review, and authorization, but it is not allowed to masquerade as proof that secret material is physically isolated from the MCU.

The stronger hardware gate requires an external secure signer and checks that:

- secret canaries do not appear in MCU RAM or flash;
- secret bytes do not appear in peripheral transcripts;
- public keys and signatures still work;
- the MCU can request a signing operation without receiving the private key.

Even that is not the end of the story. A clean emulator memory scan does not prove resistance to voltage glitching, power analysis, electromagnetic leakage, debug bypass, secure-boot failure, anti-rollback failure, or invasive silicon extraction.

Those are hardware-in-the-loop and silicon-security claims.

The important engineering habit is to keep the claim narrower than the evidence.

## Five repositories, one executable device

The lesson is not a browser mock that happens to resemble firmware. It is assembled from five source-backed layers.

| Layer | Repository | What it owns |
| --- | --- | --- |
| Domain and firmware | `Pom4H/hardware-wallet` | Setup, PIN, backup verification, reducer transitions, review, signing policy, lock, and `WFI` |
| MCU execution | `Pom4H/firmverse` | Cortex-M execution, GPIO input, mailbox frames, persistent sleep, and GPIO wake telemetry |
| Physical twin | `Pom4H/elements` | Two-button device, trusted screen, simultaneous button state, USB ports, and sleeping appearance |
| Electrical twin | `Pom4H/nodspice` | USB/3.3 V power path, display/signing loads, and active/WFI MCU branches |
| Teaching assembly | `Pom4H/anatomy` | Article, provenance, live input bridge, two-wallet flow, evidence rail, and browser proof |

The dependency direction is intentionally boring:

```text
human presses physical controls
        ↓
GPIO enters Firmverse
        ↓
Cortex-M firmware executes
        ↓
wallet-core reducer decides
        ↓
firmware emits trusted display frame
        ↓
device component renders it
        ↓
firmware power state configures NodeSpice
```

JavaScript is an adapter around the edges.

It does not decide whether the wallet is unlocked, which recovery word is visible, whether a request is approved, or whether the CPU is asleep.

## What the executable lesson proves

The happy path is deliberately long.

It starts with a blank device, not a pre-unlocked signing screen:

```text
factory blank
→ create PIN
→ confirm PIN
→ show 24-word backup
→ verify backup
→ open dashboard
→ visit settings
→ enter WFI sleep
→ wake from GPIO
→ unlock again
→ open Bitcoin
→ review transaction
→ press both buttons
→ sign
```

Then the two-wallet proof continues:

```text
wallet B verifies receive address
→ wallet A reviews B's address
→ wallet A authorizes
→ host broadcasts
→ ledger state changes
→ wallet B syncs the new balance
```

And the security inspector asks a different question:

```text
where can secret material physically exist?
```

Those three views — product lifecycle, end-to-end transfer, and isolation evidence — are more useful together than any single architecture diagram.

They also show why a hardware wallet is such a good embedded-systems teaching project. In one small device you get:

- persistent state;
- authentication;
- deterministic state machines;
- untrusted I/O;
- trusted display;
- physical input;
- cryptographic authority;
- low-power firmware;
- GPIO wake;
- circuit simulation;
- memory-isolation questions;
- and CI that can execute the whole story.

## The design rule worth keeping

The private key is not the most interesting object in a hardware wallet.

**The most interesting object is the chain of meaning between human intent and a cryptographic effect.**

A useful design keeps that chain explicit:

```text
human intent
→ physical input
→ firmware event
→ domain transition
→ trusted review
→ authorization
→ cryptographic effect
→ electrical consequence
```

If one layer says “approved” while another layer merely guessed, the system is weaker than it looks.

If every layer can be executed, inspected, and tested against the same story, the device becomes much easier to reason about.

That is the real lesson of the two-button wallet: not how to draw a tiny signer, but how to make a security-critical physical system tell the truth all the way from the user's fingers to the signature.
