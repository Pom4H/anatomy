---
title: "Anatomy of a Two-Button Hardware Wallet"
seoTitle: "How a Two-Button Hardware Wallet OS Works"
description: "A hardware-wallet OS from first boot to signing: PIN, 24-word backup, settings, trusted review, Cortex-M sleep, GPIO wake, Firmverse, and NodeSpice."
publishedAt: 2026-08-28
updatedAt: 2026-08-29
author: "Roman Popov"
readingMinutes: 18
wordCount: 3320
issue: 1
category: "Wallet systems"
level: "Beginner → embedded systems"
learningObjectives:
  - "Explain why a hardware wallet is a small security-focused operating system, not a USB signing button"
  - "Trace first boot through PIN creation, recovery backup, backup verification, and the dashboard"
  - "Use the two-button interaction grammar: left and right navigate; both buttons mean Enter"
  - "Follow a transaction from an untrusted host to trusted on-device review and physical approval"
  - "Explain how Cortex-M WFI sleep, GPIO wake, and the electrical power model fit the same device"
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
sourceCommit: "e8d23c7755eb6ca161a335930725461046aec6ce"
socialImage: "og/hardware-wallet.png"
draft: false
---

A hardware wallet is easy to misunderstand when it is reduced to one diagram:

```text
unsigned transaction → black box → signature
```

That diagram hides almost everything that makes the device usable and trustworthy. A real device must start from an empty factory state, create or restore key material, let the owner choose a PIN, display a recovery backup, verify that the backup was copied correctly, lock and unlock itself, expose apps and settings, interpret transaction bytes, ask for an unambiguous physical decision, survive power loss, enter low-power sleep, and wake from a button without silently unlocking the keys.

This lesson therefore treats the wallet as a **small security-focused operating system**. The cryptography matters, but cryptography is only one subsystem inside the product.

## The right mental model

A wallet still does not contain coins. Balances, accounts, and unspent outputs remain on a blockchain. The device controls the authority that can authorize a change to that shared state.

The complete system contains four different computers or models:

1. **The host** discovers balances, constructs a request, and broadcasts the result.
2. **The wallet firmware** owns setup, authentication, navigation, review, and signing policy.
3. **The virtual or physical MCU** executes that firmware and receives real GPIO events.
4. **The power network** decides whether the MCU and display are actually powered, sleeping, brownout-reset, or unstable.

The host may propose an operation. It must not be allowed to redefine what “approved” means.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/hardware-wallet.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/hardware-signing.gif" type="image/gif" />
    <img src="/anatomy/figures/hardware-wallet.svg" alt="An untrusted host proposes a transaction while a dedicated device parses, displays, confirms, and signs it." width="960" height="540" loading="eager" decoding="async" />
  </picture>
  <figcaption>
    <strong>System boundary</strong>
    <span>The host proposes and broadcasts. The device interprets and authorizes.</span>
    <span class="loop-figure__duration">Trusted display + physical input</span>
  </figcaption>
</figure>

<div class="key-idea">
  <span>Core idea</span>
  <p><strong>The private key is not the whole product. The operating system must connect persistent key state, the trusted screen, physical input, and the exact bytes being signed.</strong></p>
</div>

## The two-button interaction grammar

Ledger Nano devices are a useful reference because they build an entire device interface from two physical buttons and a small trusted display. The important idea is not the visual styling. It is the grammar:

<div class="interaction-grammar" aria-label="Two-button wallet interaction grammar">
  <div>
    <kbd>Left</kbd>
    <strong>Previous or decrease</strong>
    <span>Move to the previous menu item, word, review page, or PIN digit.</span>
  </div>
  <div>
    <kbd>Right</kbd>
    <strong>Next or increase</strong>
    <span>Move to the next item or increment the value currently being edited.</span>
  </div>
  <div>
    <kbd>Left + Right</kbd>
    <strong>Enter or confirm</strong>
    <span>A simultaneous physical chord accepts the item visible on the device.</span>
  </div>
</div>

The reference firmware in this lesson follows the same rule: **a single right-button press never means “approve.”** Right only navigates. Authorization requires both GPIO inputs to be high as one chord and then released.

That distinction prevents a dangerous ambiguity. When one button means both “next page” and “sign,” a timing bug, bounce, or stale screen can cross a security boundary. A separate chord gives the reducer an explicit `Enter` event.

The current demo also assigns a long press of both buttons to a control center. This is a secondary shortcut, not the transaction-approval gesture.

Ledger’s own material describes PIN selection with device controls, a device-generated 24-word recovery phrase shown on the trusted display, word verification during setup, dashboard/settings navigation, and both-button confirmation. See the official explanations of [Ledger device initialization](https://www.ledger.com/academy/basic-basics/2-how-to-own-crypto/whats-a-secret-recovery-phrase), [the 24-word backup](https://www.ledger.com/academy/basic-basics/ledgers-bit-of-it/ledger-nano-security-made-easy), and [both-button confirmation](https://developers.ledger.com/docs/device-interaction/dmk-ts/ledgerjs/beginner/cosmos-app).

## A wallet OS is several state machines

One giant `switch(screen)` is not enough. The screen is only a projection of deeper state.

<dl class="os-state-map">
  <dt>Persistent setup</dt>
  <dd>Factory blank, pending key root, committed key root, generated or restored origin, backup status, and security policy.</dd>

  <dt>Authentication</dt>
  <dd>Locked, PIN challenge, failed attempt, unlocked session, host trust, session lifetime, and forced relock.</dd>

  <dt>Navigation</dt>
  <dd>Dashboard, installed apps, settings, security, display, power, about, and the control center.</dd>

  <dt>Operation</dt>
  <dd>Request received, parsed, review prepared, review displayed, approved or rejected, executing, completed, and fail-closed error.</dd>

  <dt>Power</dt>
  <dd>Active, display-off, locked, Cortex-M `WFI`, GPIO wake edge, reset, and brownout behavior.</dd>
</dl>

These machines interact, but they should not secretly replace one another. For example:

- opening the Settings screen does not unlock a signing key;
- waking the CPU does not restore an unlocked session;
- showing an Approve page does not emit an `ExecuteOperation` effect;
- receiving bytes from USB does not make them trusted;
- turning the display off does not mean the MCU actually entered sleep.

This separation is what makes the interface feel like an operating system instead of a slideshow.

## First boot: from blank silicon to a usable wallet

The first useful screen appears before any wallet exists. The owner chooses between creating a new wallet and restoring an existing backup.

The new-device path is:

<ol class="boot-sequence">
  <li><strong>Choose new device</strong><span>The factory state contains no committed wallet root.</span></li>
  <li><strong>Create a PIN</strong><span>Left and right choose a digit. Both buttons store it and advance.</span></li>
  <li><strong>Confirm the PIN</strong><span>The second entry must match before setup continues.</span></li>
  <li><strong>Generate entropy</strong><span>A production device obtains cryptographically secure entropy inside its trusted boundary.</span></li>
  <li><strong>Derive recovery words</strong><span>The root backup is encoded as 24 words and displayed one word at a time.</span></li>
  <li><strong>Verify the backup</strong><span>The device asks the user to select words from the recorded copy.</span></li>
  <li><strong>Commit persistent state</strong><span>Only a verified backup becomes the active wallet generation.</span></li>
  <li><strong>Open the dashboard</strong><span>The device now exposes apps, settings, and normal lock behavior.</span></li>
</ol>

The interactive firmware uses a deterministic BIP-39 test vector so browser CI can repeat the exact same sequence. That fixture is intentionally not presented as production entropy. The production boundary is represented by the repository’s key-lifecycle, entropy-source, root-store, and atomic-commit interfaces.

The security rule is more important than the particular words:

> The host must never generate, receive, or render the recovery phrase for a hardware wallet.

The recovery words belong to the device’s trusted display. The owner copies them offline. In this lesson, JavaScript receives only the already-rendered screen frame sent by the firmware; it does not own the recovery state machine.

<div class="checkpoint">
  <span>Checkpoint 01</span>
  <p>A PIN protects access to one physical device. The recovery phrase recreates the wallet elsewhere. Losing one is not the same as losing the other.</p>
</div>

## Dashboard, apps, and settings

After setup, the device does not jump directly into signing. It opens a dashboard.

The reference dashboard contains:

- **Bitcoin** — an installed app that can receive a host request and prepare an on-device review;
- **Settings** — security, display, and power configuration;
- **About** — firmware and device information.

Settings are navigated with the same grammar as every other screen. There is no hidden browser-side menu. The firmware frame names the current screen and button labels.

The current executable lesson includes:

| Branch | Example items | Security meaning |
| --- | --- | --- |
| Security | Change PIN, passphrase, back | Authentication policy and wallet context |
| Display | Low, medium, high, back | Trusted-display usability, not signing authority |
| Power | Sleep now, auto-sleep, back | Lock-before-sleep and MCU power state |
| Control center | Lock, settings, sleep, close | Fast access without changing the two-button grammar |

Some production flows are intentionally summarized in the teaching firmware. “Change PIN” and “Passphrase” lead to an information screen rather than pretending that a short demo implements every irreversible maintenance operation. The important rule is that unavailable functionality is named honestly instead of simulated by decorative UI.

## PIN unlock is a domain transition

The lock screen is not merely a dark dashboard. The reducer holds an authentication state.

A successful unlock requires a sequence:

```text
UnlockRequested
  → resolve host trust
  → PinVerified
  → SessionOpened
  → unlocked wallet context
```

A wrong PIN returns to a failed challenge. A sleep transition first emits a lock request. A GPIO wake returns the interface to **Device locked**, not to the previous unlocked screen.

This is a crucial product invariant:

<div class="proof-boundary">
  <p>Power state and authorization state are independent.</p>
  <code>GPIO wake ≠ PIN verified ≠ session opened ≠ transaction approved</code>
</div>

## Trusted transaction review

The host can ask the Bitcoin app to sign, but the device moves through several review pages before an approval action exists:

1. review introduction;
2. amount and network;
3. recipient and fee;
4. explicit Approve page;
5. explicit Reject page.

Left and right only move between those pages. Both buttons on the Approve page produce `OperationConfirmed`. Only then may the reducer emit `ExecuteOperation`.

Both buttons on the Reject page produce `UserRejected`; no private-key operation follows.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/trust-boundary.svg" type="image/svg+xml" />
    <img src="/anatomy/figures/trust-boundary.svg" alt="The host request crosses into a trusted device boundary containing parsing, display, physical confirmation, and signing." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Trusted review</strong>
    <span>The device must derive the human-readable review from the same operation that reaches the signer.</span>
    <span class="loop-figure__duration">Both buttons = authorization</span>
  </figcaption>
</figure>

During signing, physical input is ignored and the firmware reports progress. When the operation completes, only the signature leaves the device. The private key does not.

<div class="checkpoint">
  <span>Checkpoint 02</span>
  <p>A secure element can protect a secret and still authorize the wrong transaction. The trusted parser, display, and physical approval path protect the user’s intent.</p>
</div>

## Sleep must be real

A screen that says “sleeping” does not prove anything about the processor.

On Cortex-M, the firmware can execute `WFI` — Wait For Interrupt. A correct emulator must stop advancing guest instructions until a permitted interrupt or wake source arrives.

The earlier Firmverse behavior immediately cleared its sleeping flag on the next tick. That made sleep a visual fiction. The runtime now preserves the architectural sleep state and exposes evidence in the browser snapshot:

```text
power.sleeping
power.sleepEntries
power.wakeCount
power.lastWakePin
```

The wallet firmware turns off the trusted display and status LED, locks the session, sends its final sleep frame, and executes `WFI`.

A rising edge on P14 or P16 then:

1. wakes the emulated Cortex-M;
2. increments the Firmverse wake counter;
3. records which GPIO caused the wake;
4. lets the firmware consume the button gesture;
5. shows the locked screen;
6. requires the PIN before returning to the dashboard.

That is a testable cross-layer statement, not a CSS animation.

## The circuit changes with firmware state

The electrical model cannot derive current from the word “Sleeping.” It needs a load model.

The NodeSpice hardware-wallet example therefore contains mutually exclusive MCU branches:

```text
3.3 V rail ─┬─ active switch ─ 73.3 Ω  ≈ 45 mA
            └─ WFI switch    ─ 33 kΩ   ≈ 0.1 mA
```

The firmware frame and Firmverse power snapshot drive three circuit inputs:

- `awake=1|0` selects active or WFI MCU load;
- `display=1|0` enables the display branch;
- `signing=1|0` enables the extra cryptographic workload branch.

This is still a first-order electrical model. It is useful for integration, state-dependent load, rail behavior, and future brownout experiments. It is not yet a transistor-level model of a selected production MCU, secure element, OLED controller, USB PHY, clock tree, or side-channel leakage.

## What each repository proves

The lesson is assembled from exact source revisions rather than one browser mock:

| Layer | Repository | Responsibility |
| --- | --- | --- |
| Domain and firmware | `Pom4H/hardware-wallet` | Onboarding, PIN, backup verification, settings, reducer transitions, review, signing, lock, and `WFI` |
| MCU execution | `Pom4H/firmverse` | PHY6252/Cortex-M execution, GPIO input, mailbox frames, persistent sleep, and GPIO wake telemetry |
| Physical twin | `Pom4H/elements` | The two-button device, trusted screen, simultaneous button state, USB ports, and sleeping appearance |
| Electrical twin | `Pom4H/nodspice` | USB/3.3 V rail, display and signing loads, and mutually exclusive active/WFI MCU branches |
| Teaching assembly | `Pom4H/anatomy` | The article, provenance, input bridge, live evidence, and browser proof |

The dependency direction matters:

```text
article controls
    ↓ GPIO only
Firmverse executes Cortex-M firmware
    ↓ firmware-owned WLT1 frame
trusted device component
    ↓ measured power state
NodeSpice load configuration
```

JavaScript is an adapter. It does not decide whether the wallet is unlocked, which recovery word is visible, whether the request is approved, or whether the CPU is asleep.

## The assembled device

Everything above now terminates in one device. Start from factory state, create the PIN, record and verify the 24 words, visit Settings, put the Cortex-M into `WFI`, wake it with a physical button, unlock it again, and approve a Bitcoin transaction with both buttons.

<section class="device-lab device-lab--assembled" data-device-lab aria-labelledby="assembled-wallet-title">
  <header class="device-lab__header">
    <div>
      <p class="lab-label">Executable final assembly</p>
      <h3 id="assembled-wallet-title">The device is the result, not the illustration</h3>
    </div>
    <p>The screen below is owned by Cortex-M firmware. The controls inject P14 and P16 GPIO edges into Firmverse. The circuit follows the observed CPU, display, and signing states.</p>
  </header>

  <div class="wallet-system">
    <div class="wallet-system__device">
      <ee-hardware-wallet
        data-reference-device
        connected
        state="setup"
        screen-title="BOOTING WALLET OS"
        screen-line-1="FIRMVERSE"
        screen-line-2="LOADING CORTEX-M"
        screen-footer="WAIT FOR FIRMWARE FRAME"
        left-label="LEFT"
        right-label="RIGHT"
        aria-label="Executable two-button hardware wallet operating system"
      ></ee-hardware-wallet>

      <div class="wallet-inputs" aria-label="Hardware wallet GPIO controls">
        <button type="button" data-wallet-left>← Left</button>
        <button type="button" data-wallet-enter>Both buttons · Enter</button>
        <button type="button" data-wallet-right>Right →</button>
        <div class="wallet-inputs__secondary">
          <button type="button" data-wallet-control>Hold both · Control center</button>
          <button type="button" data-wallet-reset>Factory reset the lesson</button>
        </div>
      </div>
    </div>

    <aside class="wallet-system__guide">
      <p class="wallet-system__status" data-device-status aria-live="polite">Firmverse is loading the wallet firmware.</p>
      <p class="wallet-system__hint" data-wallet-hint>
        <strong>Interaction grammar</strong>
        Left and right navigate. Both buttons are Enter. The next instruction comes from the current firmware state.
      </p>
    </aside>
  </div>

  <div class="wallet-system__circuit">
    <div class="wallet-system__circuit-header">
      <strong>Live electrical twin</strong>
      <span>Firmware and Firmverse select the active/WFI, display, and signing branches.</span>
      <output data-circuit-mode>ACTIVE · DISPLAY ON</output>
    </div>
    <iframe
      data-wallet-circuit
      title="NodeSpice hardware-wallet power circuit synchronized with firmware state"
      src="/anatomy/labs/nodspice/?example=hardware-wallet-power&amp;embed=1&amp;view=schematic&amp;awake=1&amp;display=1&amp;signing=0"
      loading="lazy"
    ></iframe>
  </div>

  <div class="device-lab__evidence" data-wallet-evidence aria-label="Live cross-layer proof">
    <div><small>Wallet OS</small><strong>Firmware screen</strong><span data-domain-state>booting</span></div>
    <div><small>Frame ABI</small><strong>WLT1 v2</strong><span data-frame-state>waiting</span></div>
    <div><small>Physical input</small><strong>P14 / P16</strong><span data-gpio-state>waiting</span></div>
    <div><small>Processor</small><strong>Cortex-M / WFI</strong><span data-power-state>starting</span></div>
    <div><small>Electrical twin</small><strong>NodeSpice</strong><span data-circuit-state>active branch</span></div>
    <div><small>Provenance</small><strong>4 pinned repos</strong><span data-provenance-state>checking</span></div>
  </div>

  <footer class="lab-footer">
    <span>The recovery words are a deterministic public test vector for reproducible teaching and CI. Do not use them for funds. Production entropy, secure storage, silicon timing, and side-channel resistance require hardware-in-the-loop validation.</span>
    <a href="https://github.com/Pom4H/anatomy">Inspect the complete assembly ↗</a>
  </footer>
</section>
