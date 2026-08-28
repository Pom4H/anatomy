---
title: "How Software and Hardware Wallets Work"
seoTitle: "How Software and Hardware Crypto Wallets Work"
description: "A visual guide to private keys, addresses, transaction signing, recovery phrases, software wallets, hardware wallets, and their security boundaries."
publishedAt: 2026-08-28
updatedAt: 2026-08-28
author: "Roman Popov"
readingMinutes: 17
wordCount: 2988
issue: 1
category: "Wallet fundamentals"
level: "Beginner → intermediate"
learningObjectives:
  - "Explain why a wallet stores keys, not coins"
  - "Trace a transaction from human intent to network confirmation"
  - "Compare the signing boundary of software and hardware wallets"
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

A crypto wallet does not contain coins. The coins remain recorded on a blockchain. What the wallet controls is the **authority to change that record**: cryptographic keys, account information, and the software that prepares and signs operations.

That single idea explains both software and hardware wallets. They perform the same logical job, but they place the most sensitive part of that job in different environments.


## The shortest useful model

There are three systems involved:

1. **The blockchain** keeps the shared ledger and verifies rules.
2. **The wallet** discovers accounts, prepares operations, and manages signing authority.
3. **The network** carries unsigned data, signed transactions, blocks, and state updates.

The wallet is therefore closer to a **key manager plus transaction workstation** than to a vault full of digital coins.

<figure class="wide-figure lesson-figure">
  <img src="/anatomy/figures/wallet-model.svg" alt="A wallet holds keys and creates signatures while assets remain recorded on the blockchain ledger." width="1600" height="900" loading="eager" decoding="async" />
  <figcaption><strong>Figure 01</strong><span>The ledger records ownership conditions. The wallet holds or controls the signing authority needed to satisfy them.</span></figcaption>
</figure>

Imagine an account with 2 ETH. The ether is not inside a phone, browser extension, USB device, or recovery card. Ethereum nodes agree that a particular account has that balance. A valid signature can authorize a state transition from that account. The private key is what makes that authorization possible.

Bitcoin expresses ownership differently—with unspent transaction outputs and spending conditions rather than an account balance—but the wallet's central role is similar: find spendable outputs, construct a transaction, and produce the signatures required to spend them.

<div class="key-idea">
  <span>Core idea</span>
  <p><strong>Assets live on the ledger. Keys create authorization. A wallet connects human intent to a valid cryptographic operation.</strong></p>
</div>

## Four objects people often confuse

Before comparing wallet types, separate four related objects.

### Private key

A private key is secret cryptographic material. It is used to create a digital signature. Whoever can use the relevant private key can usually authorize operations for the corresponding account or output.

A private key is not a password sent to the blockchain. The network never needs to learn it. The network receives a signature and verifies that signature with public information.

### Public key

A public key is derived from the private key. It can be shared. Depending on the protocol, it is used directly or indirectly to verify signatures and derive an address.

Derivation is intentionally one-way in practice: computing the public key from the private key is easy; recovering the private key from the public key is assumed to be computationally infeasible for the cryptography in use.

### Address

An address is a protocol-specific identifier derived from a public key, script, or account rule. It is designed to be shared with others.

An address is not the public key in every system, and it is not a secret. Different chains encode addresses differently, and one key may be represented by different address formats.

### Signature

A signature binds approval to specific data. The network checks that the signature is valid for the transaction or message and for the expected key.

A correct signature does not normally reveal the private key. This is what allows a wallet to authorize a transaction without publishing the secret that authorized it.

<figure class="wide-figure lesson-figure">
  <img src="/anatomy/figures/key-signature.svg" alt="A private key derives a public key and address, and signs transaction data to create a verifiable signature." width="1600" height="900" loading="lazy" decoding="async" />
  <figcaption><strong>Figure 02</strong><span>Addresses identify destinations. Signatures authorize specific data. The private key should remain inside the wallet's most trusted boundary.</span></figcaption>
</figure>

<div class="checkpoint">
  <span>Checkpoint 01</span>
  <p>If someone knows your address, can they spend your funds? <strong>No.</strong> The address is public. Spending requires satisfying the authorization rules, commonly with a valid signature.</p>
</div>

## From recovery words to many accounts

Modern wallets rarely ask users to back up hundreds of unrelated private keys. Instead, many use a deterministic hierarchy.

A typical flow looks like this:

1. The wallet generates cryptographically secure random entropy.
2. A backup format encodes that entropy, often as a recovery phrase.
3. The phrase, sometimes combined with an optional passphrase, produces a seed.
4. The seed becomes the root of a deterministic key tree.
5. Derivation paths select accounts and child keys.
6. Public keys and protocol rules produce addresses.

<figure class="wide-figure lesson-figure">
  <img src="/anatomy/figures/key-derivation.svg" alt="Entropy becomes recovery words, a seed, a hierarchical key tree, accounts, public keys, and addresses." width="1600" height="900" loading="lazy" decoding="async" />
  <figcaption><strong>Figure 03</strong><span>One backup can reproduce a deterministic family of keys. The exact standards and derivation rules vary by wallet and chain.</span></figcaption>
</figure>

For Bitcoin-compatible wallets, [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) specifies hierarchical deterministic key derivation. [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) describes one widely used mnemonic-to-seed scheme. Other ecosystems and newer wallet designs may use different backup and derivation mechanisms.

The recovery phrase is therefore not a list of account passwords. It is human-transcribable material from which a wallet can reproduce the root secret and derive the same key hierarchy.

This has an important consequence:

> A copy of the recovery material can be as powerful as the device itself.

A thief who obtains a valid recovery phrase and any required passphrase may restore the wallet elsewhere. They do not need the original phone or hardware device.

### PIN, password, recovery phrase, passphrase

These protect different things:

| Item | Primary role | What happens if it is lost or stolen |
| --- | --- | --- |
| App password | Encrypts or unlocks local wallet data | Loss may block that installation; theft may help decrypt it |
| Device PIN | Controls local access to a hardware device | It does not restore the wallet on a replacement device |
| Recovery phrase / backup | Reconstructs root wallet material | Theft can enable full recovery elsewhere |
| Optional wallet passphrase | Changes the derived wallet context | A wrong value opens a different wallet; loss can be permanent |

A local PIN can slow down an attacker holding the device. It does not replace the backup. A backup can restore access after the device is destroyed. It can also bypass the original device's PIN if an attacker obtains it.

## How a software wallet works

A **software wallet** performs wallet operations inside a general-purpose environment such as a browser, desktop operating system, or phone.

The exact design varies, but a self-custodial software wallet commonly contains:

- an account and address database;
- network or RPC connections;
- transaction-building logic;
- chain-specific parsers and fee estimation;
- encrypted key or seed storage;
- signing code;
- user-interface code for approval.

<figure class="wide-figure lesson-figure">
  <img src="/anatomy/figures/software-wallet.svg" alt="A software wallet receives chain state, builds a transaction, asks for approval, unlocks a local key, signs, and broadcasts from one general-purpose device." width="1600" height="900" loading="lazy" decoding="async" />
  <figcaption><strong>Figure 04</strong><span>In a typical software wallet, networking, transaction interpretation, user approval, and private-key use happen within the same host security domain.</span></figcaption>
</figure>

### Sending from a software wallet, step by step

Suppose Alice wants to send an asset to Bob.

1. **Read chain state.** The wallet queries a node or RPC service for balances, nonces, UTXOs, fees, and recent transactions.
2. **Collect intent.** Alice enters Bob's address, an amount, and perhaps a fee preference or contract action.
3. **Build the operation.** The wallet converts that intent into chain-specific transaction bytes.
4. **Show a review.** The same application renders a summary for Alice.
5. **Unlock signing authority.** A password, biometric prompt, operating-system key store, or app session releases access to the relevant secret.
6. **Sign.** Wallet code creates the required signature or signatures.
7. **Assemble and broadcast.** The signed transaction is submitted to a node.
8. **Track confirmation.** The wallet monitors the chain and updates its local view.

The convenience is obvious: one application can discover funds, build a transaction, sign it, broadcast it, and display the result.

The security trade-off is equally important: the environment that shows the destination may also be the environment that holds and uses the key. If malware can control that environment deeply enough, it may steal secret material, alter what is signed, replace addresses, or trick the user through a fake interface.

### “Software wallet” is a spectrum

Not every software wallet is equally exposed. A mobile wallet may use hardware-backed operating-system key storage. A browser extension has a different attack surface from a dedicated phone. A multisignature or MPC wallet may distribute authority across several components. A smart-contract wallet may enforce policies beyond one private key.

The useful question is not simply “Is it software?” It is:

> Which components can access signing authority, and which components are trusted to interpret the transaction correctly?

## How a hardware wallet works

A **hardware wallet** separates signing authority from the general-purpose host.

The computer or phone still does most network-facing work. A companion wallet usually discovers balances, chooses inputs, estimates fees, constructs an unsigned transaction, and broadcasts the result. The hardware device focuses on keys, transaction review, policy, and signing.

<figure class="wide-figure lesson-figure">
  <img src="/anatomy/figures/hardware-wallet.svg" alt="An online host builds an unsigned transaction and sends it to a hardware signer, which independently reviews and signs it before returning a signature for broadcast." width="1600" height="900" loading="lazy" decoding="async" />
  <figcaption><strong>Figure 05</strong><span>The host remains useful but untrusted. The hardware device must independently understand enough of the operation to show what it is about to authorize.</span></figcaption>
</figure>

### Sending with a hardware wallet, step by step

1. **The host reads chain state.** The companion app talks to nodes or RPC services.
2. **The host builds an unsigned operation.** It chooses inputs or account fields and serializes chain-specific data.
3. **The host sends the request to the device.** USB, Bluetooth, NFC, QR codes, or another transport may be used.
4. **The device parses the operation.** It should derive the meaning from the actual bytes it will sign—not trust a friendly summary supplied by the host.
5. **The device displays trusted details.** Destination, amount, fee, network, method, or other relevant fields appear on the device's own screen.
6. **The user confirms physically.** Buttons or a touchscreen approve the operation on the device itself.
7. **The device derives the required key and signs.** Secret material stays inside the device's protected execution boundary according to its implementation.
8. **The device returns signatures or a signed artifact.** The host receives only what it needs to complete the transaction.
9. **The host broadcasts.** A signed transaction does not need to remain secret.

Bitcoin's developer guide describes a similar split between a networked wallet and a signing-only wallet: the online side derives public information and builds unsigned transactions, while the signing side reviews and signs them. A hardware wallet packages that separation into a dedicated device. [Bitcoin Developer Guide: Wallets](https://developer.bitcoin.org/devguide/wallets.html)

### The screen is part of the security model

If a compromised laptop says “Send 0.1 BTC to Bob,” but sends the device a transaction paying Mallory, the device only helps if it can reveal that mismatch.

This is why a trusted display matters. The user must compare the destination and amount shown on the hardware wallet with their real intent. Trezor describes the device display as the place to verify the actual address or transaction being processed, while Ledger's Clear Signing documentation emphasizes rendering human-readable transaction details rather than raw calldata.

The hardware device is not merely an external key-shaped USB drive. It is a **small independent authorization computer**.

<div class="key-idea">
  <span>Security boundary</span>
  <p><strong>The host may propose an operation. The signer must decide what the operation means, show that meaning on trusted hardware, and require approval before using a private key.</strong></p>
</div>

## The same transaction, two trust boundaries

Software and hardware wallets can produce an identical valid transaction. The difference is where key use and trusted review happen.

<figure class="wide-figure lesson-figure">
  <img src="/anatomy/figures/wallet-comparison.svg" alt="Side-by-side comparison: a software wallet signs inside the online host, while a hardware wallet moves parsing, trusted review, confirmation, and signing into a separate device." width="1600" height="900" loading="lazy" decoding="async" />
  <figcaption><strong>Figure 06</strong><span>Both paths end with a signed transaction. Hardware moves the highest-value authority behind a narrower, independently operated boundary.</span></figcaption>
</figure>

| Question | Software wallet | Hardware wallet |
| --- | --- | --- |
| Where are keys normally used? | On the phone, browser, or computer | Inside a dedicated signing device |
| Who usually talks to the network? | The wallet application | The companion application |
| Where is the transaction reviewed? | On the host screen | On the device's trusted display |
| Main advantage | Speed and convenience | Isolation from host compromise |
| Main operational burden | Secure the general-purpose device | Secure the device, backup, firmware path, and physical review |
| Can it be self-custodial? | Yes | Yes |
| Does it store coins? | No | No |

## What hardware wallets protect against

A well-designed hardware wallet can reduce several risks.

### Key extraction from host malware

The host can request signatures without receiving raw private keys. Compromising the laptop should not automatically reveal the seed or private key held by the signer.

### Silent signing

Physical confirmation makes it harder for host malware to trigger an invisible private-key operation in the background.

### Address substitution—when the user verifies

A trusted display can reveal that the destination or amount reaching the device differs from what the host showed.

### Broad host attack surface

A dedicated signer can have a much smaller software and hardware surface than a browser, phone, or desktop OS. Smaller does not mean bug-free, but it can make reasoning and auditing more tractable.

## What hardware wallets do not protect against

Hardware does not remove the need for judgment.

### Confirming the attacker's transaction

If the device clearly shows Mallory's address and the user approves it anyway, the wallet has correctly signed the wrong intent.

### Recovery-phrase theft

Anyone who restores the backup elsewhere can bypass the original device. Typing the recovery phrase into a website or compromised computer defeats the isolation the hardware wallet was meant to provide.

### Incomplete transaction interpretation

Complex smart-contract calls may be difficult to render. If the device shows only an opaque hash or raw bytes, the user is blind-signing. The key may remain isolated while the authorization is still unsafe.

### Bugs in firmware, parsers, cryptography, or hardware

The signer must parse hostile input, enforce state transitions, protect secrets, implement cryptography, and update safely. A defect in any layer can weaken the boundary.

### Supply-chain and physical attacks

Authenticity checks, secure boot, signed firmware, tamper resistance, retry counters, secure elements, and careful setup can mitigate physical risks. They do not make every device invulnerable.

### Bad source information

A trusted display can confirm that the device is signing the address it received. It cannot prove that Bob originally gave Alice the correct address. Verification still needs an independent source of truth.

<div class="checkpoint">
  <span>Checkpoint 02</span>
  <p>A hardware wallet shows the correct transaction but the destination came from a phishing message. Did the device fail? <strong>No.</strong> It verified execution integrity, not the real-world identity of the recipient.</p>
</div>

## Recovery: losing a device is not losing a wallet

If a deterministic wallet's device is lost but the backup is intact, compatible software or replacement hardware can reconstruct the same root material and derive the same accounts.

That is why the backup is simultaneously the recovery mechanism and one of the largest security risks.

<figure class="wide-figure lesson-figure">
  <img src="/anatomy/figures/recovery.svg" alt="A recovery backup can restore the same deterministic wallet on replacement hardware or compatible software, while a stolen backup can also recreate the wallet." width="1600" height="900" loading="lazy" decoding="async" />
  <figcaption><strong>Figure 07</strong><span>The device is replaceable. The recovery secret is the durable root of authority.</span></figcaption>
</figure>

A practical mental model is:

- **Device:** an execution environment for the wallet.
- **PIN:** local protection for that execution environment.
- **Backup:** portable root authority.
- **Passphrase:** optional extra input that selects a different deterministic wallet.

Never test a real backup by entering it into an arbitrary website. Never photograph it if the photo may reach cloud storage. Never assume a support agent needs it.

## Custodial accounts are a different model

An exchange app may look like a wallet, but if the exchange controls the signing keys, the user is interacting with a custodial account. The exchange authorizes on-chain withdrawals on the user's behalf.

“Software versus hardware” describes where signing logic and secrets live. “Custodial versus self-custodial” describes who ultimately controls the authorization.

These dimensions are independent:

- a self-custodial mobile app is a software wallet;
- a self-custodial dedicated signer is a hardware wallet;
- an exchange account is custodial even if accessed from highly secure hardware;
- a multisignature wallet may distribute custody across software and hardware signers.

Smart-contract wallets add another layer: the blockchain account itself may implement multiple keys, recovery guardians, spending limits, or replaceable authorization. The same questions still help—where does authority live, what exactly is signed, and which display can be trusted?—but the authorization policy is no longer necessarily one private key controlling one account.

## A complete transaction in one picture

The full lifecycle can now be summarized without using the word “coin storage” at all:

1. The wallet derives or selects an account.
2. It reads relevant blockchain state.
3. It turns human intent into protocol data.
4. A trusted component presents what will be authorized.
5. The user approves.
6. A signer creates a signature with the correct private key.
7. The signed transaction is broadcast.
8. Nodes verify it and update their shared state if all rules pass.

The blockchain does not ask whether the signature came from a phone or a dedicated device. It only checks protocol validity. Hardware wallets improve the process by moving key use and trusted review away from the large, networked host.

## Choosing between them

Use the threat model, not a slogan.

A software wallet may be appropriate when:

- the value at risk is limited;
- frequent transactions and fast access matter;
- the device is well maintained;
- recovery procedures are understood;
- the wallet uses strong platform security and a narrow permission model.

A hardware wallet becomes more valuable when:

- compromise of the daily-use computer is plausible;
- assets are significant or held for long periods;
- transaction review can be performed carefully;
- the backup can be protected independently;
- the user accepts the extra operational steps.

For larger systems, the answer may be neither one device nor one key. Multisignature, policy engines, separate approval roles, smart-contract accounts, and institutional custody can reduce dependence on a single signer.

<div class="lesson-summary">
  <p class="lesson-summary__label">The lesson in seven lines</p>
  <ol>
    <li>Wallets control keys; blockchains record assets.</li>
    <li>Private keys sign; public information verifies.</li>
    <li>Recovery material can reproduce a deterministic family of keys.</li>
    <li>A software wallet signs inside a general-purpose host.</li>
    <li>A hardware wallet moves trusted review and signing into a dedicated device.</li>
    <li>Hardware isolates keys, but cannot correct careless approval or a stolen backup.</li>
    <li>Security comes from the entire authorization flow, not from the storage chip alone.</li>
  </ol>
</div>

## Explore the implementation

The open-source [Pom4H/hardware-wallet](https://github.com/Pom4H/hardware-wallet) repository is a reference implementation of the boundaries explained in this lesson. Its generic Rust core models provisioning, authorization, sessions, policy, user approval, and operation lifecycle, while chain-specific modules parse and execute narrow Bitcoin, Ethereum, and Solana flows.

The repository is experimental and is not intended to protect real funds. Its value here is educational: the code makes the trust boundary and state transitions concrete.

### Primary references

- [Bitcoin Developer Guide: Wallets](https://developer.bitcoin.org/devguide/wallets.html)
- [BIP-32: Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP-39: Mnemonic code for generating deterministic keys](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [Ethereum.org: Accounts](https://ethereum.org/developers/docs/accounts/)
- [Trezor: Trusted Display](https://trezor.io/guides/trezor-devices/trezor-fundamentals/trezor-s-trusted-display-verify-every-address-on-your-device)
- [Ledger Developer Portal: Clear Signing for wallets](https://developers.ledger.com/docs/clear-signing/for-wallets)
