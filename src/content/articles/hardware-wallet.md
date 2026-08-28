---
title: "How Software and Hardware Wallets Work"
seoTitle: "How Software and Hardware Crypto Wallets Work"
description: "A visual guide to private keys, transaction signing, recovery phrases, software wallets, hardware wallets, and the trust boundary between them."
publishedAt: 2026-08-28
updatedAt: 2026-08-28
author: "Roman Popov"
readingMinutes: 12
wordCount: 2363
issue: 1
category: "Wallet fundamentals"
level: "Beginner → intermediate"
learningObjectives:
  - "Explain why a wallet stores keys, not coins"
  - "Distinguish private keys, public keys, addresses, and signatures"
  - "Trace a transaction through software-wallet and hardware-wallet signing"
  - "Recognize what a hardware wallet can and cannot protect"
tags:
  - "software wallet"
  - "hardware wallet"
  - "private keys"
  - "transaction signing"
  - "self-custody"
  - "cryptography"
repository: "https://github.com/Pom4H/hardware-wallet"
sourceCommit: "af1f103b0d7404178ab64b0f717f1af188bdd5fe"
socialImage: "og/hardware-wallet.png"
draft: false
---

A crypto wallet does not contain coins. Coins, tokens, balances, and unspent outputs remain recorded on a blockchain. What a wallet controls is the **authority to change that record**.

That authority is represented by cryptographic keys and the software that turns human intent into a transaction, asks for approval, creates signatures, and sends the result to the network.

Software wallets and hardware wallets perform the same logical job. Their main difference is **where the private key is used and which screen is trusted when the user approves a transaction**.

## A wallet stores authority, not assets

There are three systems in the shortest useful model:

1. **The blockchain** stores the shared state and validates protocol rules.
2. **The wallet** discovers accounts, builds operations, and manages signing authority.
3. **The network** carries transactions, blocks, and state updates between participants.

If an Ethereum account has 2 ETH, those 2 ETH are not inside a phone, browser extension, or USB device. Nodes agree that the account has that balance. A valid signature can authorize a state transition from it.

Bitcoin represents ownership differently, using unspent transaction outputs and spending conditions rather than one account balance. The mental model is still useful: the ledger records what may be spent, and the wallet produces the authorization required to spend it.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/wallet-model.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/wallet-ledger.gif" type="image/gif" />
    <img src="/anatomy/figures/wallet-model.svg" alt="A wallet creates a signature that authorizes a state change on a blockchain ledger; the assets remain on the ledger." width="960" height="540" loading="eager" decoding="async" />
  </picture>
  <figcaption>
    <strong>Loop 01</strong>
    <span>The ledger stores state. The wallet stores or controls the authority that can change it.</span>
    <span class="loop-figure__duration">4 seconds · silent loop</span>
  </figcaption>
</figure>

<div class="key-idea">
  <span>Core idea</span>
  <p><strong>A wallet is a key manager and transaction workstation. It is not a container full of digital coins.</strong></p>
</div>

## Private key, public key, address, and signature

These four objects are related, but they are not interchangeable.

### Private key

A private key is secret cryptographic material used to create signatures. Anyone who can use the relevant private key can usually authorize operations controlled by that key.

The private key is not transmitted to the blockchain. The network does not need to learn it.

### Public key

A public key is derived from a private key and can be shared. It allows other participants to verify signatures without gaining the ability to create them.

For the cryptographic systems used by major blockchains, deriving the public key from the private key is practical, while reversing that derivation is assumed to be computationally infeasible.

### Address

An address is a protocol-specific identifier derived from a public key, script, or account rule. It is designed to be shared.

An address is not always identical to a public key. Different chains and account types encode addresses differently, and one key can sometimes correspond to several address formats.

### Signature

A signature proves that the holder of a private key authorized specific data. The network verifies that signature using public information.

A signature is only meaningful in relation to the exact transaction or message that was signed. This is why a wallet must connect the human-readable review to the same bytes used by the signing operation.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/key-signature.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/keys-signature.gif" type="image/gif" />
    <img src="/anatomy/figures/key-signature.svg" alt="A private key derives a public key and address, and signs transaction data to create a verifiable signature." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Loop 02</strong>
    <span>Derivation creates public identity. Signing creates authorization for one specific operation.</span>
    <span class="loop-figure__duration">5.5 seconds · silent loop</span>
  </figcaption>
</figure>

<div class="checkpoint">
  <span>Checkpoint 01</span>
  <p>If another person knows your address, can they spend your funds? <strong>No.</strong> An address is public. Spending requires satisfying the authorization rules, commonly with a valid signature.</p>
</div>

## Recovery creates a deterministic key tree

A wallet may control many accounts and addresses. Backing up every private key separately would be impractical, so many wallets derive them from one root.

A common deterministic flow is:

1. The wallet generates cryptographically secure random entropy.
2. A backup format encodes that entropy, often as recovery words.
3. The recovery material, sometimes combined with a passphrase, produces a seed.
4. The seed becomes the root of a deterministic key hierarchy.
5. Derivation paths select accounts and child keys.
6. Public keys and protocol rules produce addresses.

For Bitcoin-compatible wallets, [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) defines hierarchical deterministic key derivation. [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) defines one widely used mnemonic-to-seed scheme. Other ecosystems and modern wallet designs may use different recovery mechanisms.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/key-derivation.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/recovery-tree.gif" type="image/gif" />
    <img src="/anatomy/figures/key-derivation.svg" alt="Recovery words produce a seed, a root key, multiple accounts, and repeatable addresses." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Loop 03</strong>
    <span>One backup can reproduce a family of keys. It does not contain the assets themselves.</span>
    <span class="loop-figure__duration">6 seconds · silent loop</span>
  </figcaption>
</figure>

This creates an important security consequence:

> A copy of the recovery material can be as powerful as the original wallet.

Someone who obtains the recovery phrase and any required passphrase may restore the keys elsewhere. They do not need the original phone or hardware device.

A PIN, password, recovery phrase, and optional wallet passphrase protect different things:

| Item | Main purpose | What theft or loss means |
| --- | --- | --- |
| App password | Unlocks or decrypts one local installation | May expose or block that installation |
| Hardware-wallet PIN | Controls access to one physical device | Does not recreate the wallet on another device |
| Recovery phrase or backup | Reconstructs root wallet material | Theft may enable full recovery elsewhere |
| Optional wallet passphrase | Changes the derived wallet context | A wrong value opens a different wallet; loss may be permanent |

## How a software wallet signs a transaction

A software wallet runs in a general-purpose environment such as a phone, browser, or desktop operating system.

A self-custodial software wallet commonly includes:

- account and address discovery;
- RPC or node connectivity;
- chain-specific transaction construction;
- fee estimation;
- encrypted key or seed storage;
- signing code;
- the interface used to review and approve operations.

Suppose Alice wants to send an asset to Bob. A typical flow is:

1. **Read chain state.** The wallet queries balances, nonces, UTXOs, fees, and recent transactions.
2. **Collect intent.** Alice enters Bob's address, an amount, and perhaps a fee preference or contract action.
3. **Build the transaction.** The wallet converts that intent into chain-specific bytes.
4. **Show a review.** The application presents destination, amount, and fee.
5. **Unlock the key.** A password, biometric prompt, OS key store, or active session releases signing capability.
6. **Sign.** Wallet code creates the required signatures.
7. **Broadcast.** The signed transaction is submitted to the network.
8. **Track confirmation.** The wallet updates its local view as the chain changes.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/software-wallet.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/software-signing.gif" type="image/gif" />
    <img src="/anatomy/figures/software-wallet.svg" alt="Inside one host, a software wallet builds, reviews, signs, and broadcasts a transaction using a locally available private key." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Loop 04</strong>
    <span>Networking, transaction interpretation, user approval, and private-key use usually share one host security domain.</span>
    <span class="loop-figure__duration">6.5 seconds · silent loop</span>
  </figcaption>
</figure>

The benefit is convenience. One application can discover funds, build a transaction, sign it, broadcast it, and display the result.

The trade-off is that the same environment may control both **what the user sees** and **which data the private key signs**. Malware with enough control may steal secret material, replace an address, alter transaction bytes, or display a false summary.

“Software wallet” is still a spectrum. A mobile wallet may use hardware-backed OS key storage. A browser extension has a different attack surface from a dedicated phone. Multisignature, MPC, account abstraction, and smart-contract wallets can distribute authority across several components.

The useful question is not merely “Is it software?” It is:

> Which component can use the signing authority, and which component is trusted to interpret the transaction?

## How a hardware wallet signs a transaction

A hardware wallet separates private-key use from the general-purpose host.

The computer or phone still performs most network-facing work. It discovers balances, selects inputs, estimates fees, builds an unsigned transaction, and later broadcasts the signed result.

The dedicated device focuses on a narrower job:

- protect or isolate key material;
- parse the operation it receives;
- show trusted transaction details;
- require physical approval;
- derive the required key;
- create and return signatures.

A typical flow is:

1. **The host reads chain state.** The companion app talks to nodes or RPC services.
2. **The host builds an unsigned operation.** It chooses fields and serializes chain-specific data.
3. **The host sends the request to the device.** The transport might be USB, Bluetooth, NFC, QR, or another channel.
4. **The device parses the operation.** It derives meaning from the actual bytes it will sign.
5. **The device displays trusted details.** Destination, amount, fee, network, method, or other relevant fields appear on the device.
6. **The user confirms physically.** A button or touchscreen approves the operation on the signer itself.
7. **The device signs.** The relevant private key is used inside the device's protected execution boundary.
8. **The device returns a signature or signed artifact.** The host does not need the raw private key.
9. **The host broadcasts.** Signed transaction data does not need to remain secret.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/hardware-wallet.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/hardware-signing.gif" type="image/gif" />
    <img src="/anatomy/figures/hardware-wallet.svg" alt="An online host sends an unsigned transaction to a hardware wallet, which parses, displays, confirms, and signs it before returning the result." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Loop 05</strong>
    <span>The host proposes and broadcasts. The dedicated signer independently interprets and authorizes.</span>
    <span class="loop-figure__duration">7.75 seconds · silent loop</span>
  </figcaption>
</figure>

Bitcoin's developer documentation describes a related split between a networked wallet and a signing-only wallet: the online side builds unsigned transactions, while the signing side reviews and signs them. A hardware wallet packages this separation into a dedicated device. See the [Bitcoin Developer Guide: Wallets](https://developer.bitcoin.org/devguide/wallets.html).

## Why the hardware-wallet screen matters

A hardware wallet is useful only if the device can independently tell the user what it is about to authorize.

Imagine that a compromised laptop displays:

```text
Send 0.10 BTC to Bob
```

but transmits transaction bytes that pay Mallory.

If the hardware device signs a digest without understanding the transaction, the key may remain physically isolated while the authorization is still wrong. The device has protected the secret but failed to protect the user's intent.

A trusted-display design derives the review from the actual operation and stops before signing when the user rejects a mismatch.

<figure class="loop-figure">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/anatomy/figures/trust-boundary.svg" type="image/svg+xml" />
    <source srcset="/anatomy/generated/wallets/mismatch-rejected.gif" type="image/gif" />
    <img src="/anatomy/figures/trust-boundary.svg" alt="The host claims the recipient is Bob, but the device parses Mallory from the transaction and rejects the signing request." width="960" height="540" loading="lazy" decoding="async" />
  </picture>
  <figcaption>
    <strong>Loop 06</strong>
    <span>The trusted device display connects human approval to the exact bytes that would be signed.</span>
    <span class="loop-figure__duration">5.25 seconds · silent loop</span>
  </figcaption>
</figure>

Trezor describes its device display as the trusted place to verify addresses and transaction details. Ledger uses the term “clear signing” for rendering human-readable transaction meaning instead of asking the user to approve opaque data.

<div class="key-idea">
  <span>Security boundary</span>
  <p><strong>The host may propose an operation. The signer must independently interpret it, show the result on trusted hardware, and require approval before using a private key.</strong></p>
</div>

## The same transaction, two trust boundaries

Both wallet types may produce the same valid network transaction. The difference is where the critical authority lives.

| Question | Software wallet | Hardware wallet |
| --- | --- | --- |
| Where is the private key normally used? | On the phone, browser, or computer | Inside a dedicated signing device |
| Who usually talks to the blockchain network? | The wallet application | The companion application |
| Where is the transaction reviewed? | On the host screen | On the device display |
| Main advantage | Speed and convenience | Isolation from host compromise |
| Main burden | Secure the general-purpose device | Secure the device, backup, firmware path, and physical review |
| Can it be self-custodial? | Yes | Yes |
| Does it store coins? | No | No |

### What a hardware wallet can reduce

A well-designed hardware wallet can reduce the risk of:

- raw-key extraction by host malware;
- silent background signing;
- address substitution, when the user verifies the device display;
- exposing high-value signing authority to the broad attack surface of a browser or desktop OS.

### What it cannot solve automatically

A hardware wallet does not protect against:

- approving the attacker's transaction after the device shows it correctly;
- recovery-phrase theft;
- blind signing of operations the device cannot explain;
- firmware, parser, cryptographic, hardware, or supply-chain defects;
- receiving a malicious address from an already compromised source;
- coercion, poor backups, or operational mistakes.

<div class="checkpoint">
  <span>Checkpoint 02</span>
  <p>If malware controls the laptop but the user carefully verifies the destination and amount on a capable hardware wallet, what has changed? <strong>The malware may still build and broadcast transactions, but it no longer controls the final trusted review and private-key operation.</strong></p>
</div>

## Custodial and self-custodial are separate questions

“Software versus hardware” describes where signing happens. “Custodial versus self-custodial” describes who ultimately controls the signing authority.

- A self-custodial software wallet lets the user control the keys.
- A self-custodial hardware wallet also lets the user control the keys, with a separate signer.
- A custodial service may expose a wallet-like application while the provider controls the keys.
- Some systems distribute authority using multisignature, MPC, policy engines, or smart contracts.

Do not assume that every phone wallet is custodial or that every device-shaped product is self-custodial. Follow the signing authority.

## How to choose

A software wallet may be appropriate when:

- the value at risk is limited;
- transactions are frequent;
- convenience matters strongly;
- the host device is well maintained;
- the wallet is used as a daily spending account.

A hardware wallet becomes more attractive when:

- compromise of the main computer must not expose keys directly;
- the value at risk justifies a separate device;
- transactions are less frequent and can tolerate deliberate review;
- the user can manage backups and firmware safely;
- the device can clearly explain the operations being signed.

Many people use both: a software wallet for routine activity and a hardware wallet for higher-value or lower-frequency authority.

## A reference implementation

The open-source [`Pom4H/hardware-wallet`](https://github.com/Pom4H/hardware-wallet) project explores the hardware-wallet boundary as a deterministic Rust domain model.

Its generic core models provisioning, authorization, sessions, wallet contexts, policy, device-owned review, physical confirmation, and operation lifecycle. Chain-specific modules parse and explain narrow Bitcoin, Ethereum, and Solana reference flows.

The central reducer rule is:

```text
State + Event → State + Effect
```

The core does not store raw seed, PIN, passphrase, private key, or transaction bytes. Secret-bearing work is represented as effects executed by an isolated runtime. This allows the security invariants to be tested independently from a future physical board.

The project remains experimental and must not be used to protect real funds. Its value here is as a concrete implementation of the trust boundary described in this lesson.

## Summary

1. Assets remain recorded on a blockchain; wallets control signing authority.
2. Private keys create signatures. Public keys verify them. Addresses identify destinations or spending rules.
3. Recovery material can reproduce a deterministic family of keys and may be as powerful as the device.
4. A software wallet usually builds, reviews, signs, and broadcasts inside one general-purpose host.
5. A hardware wallet moves trusted review and private-key use into a separate signer.
6. The device display matters because approval must refer to the same bytes that are signed.
7. Hardware reduces some host risks, but it does not protect a stolen backup or a user who approves the wrong operation.

The question to ask of any wallet is therefore:

> **Which component can use the key, which component explains the transaction, and what must the human trust?**
