---
title: "Hardware Wallet: кошелёк, который не доверяет компьютеру"
seoTitle: "Аппаратный кошелёк на Rust: архитектура Hardware Wallet"
description: "Разбираю open-source аппаратный кошелёк на Rust: границы доверия, state machine, физическое подтверждение и локальный CI для Bitcoin, Ethereum и Solana."
publishedAt: 2026-08-28
updatedAt: 2026-08-28
author: "Роман Попов"
readingMinutes: 15
wordCount: 2203
issue: 1
category: "Security architecture"
tags:
  - "hardware wallet"
  - "аппаратный криптокошелёк"
  - "Rust"
  - "embedded"
  - "cryptography"
  - "Bitcoin"
  - "Ethereum"
  - "Solana"
repository: "https://github.com/Pom4H/hardware-wallet"
sourceCommit: "af1f103b0d7404178ab64b0f717f1af188bdd5fe"
socialImage: "og/hardware-wallet.png"
draft: false
---

Аппаратный кошелёк часто описывают как маленькую флешку, внутри которой лежат приватные ключи. Для покупателя это удобная метафора. Для инженера — опасно неполное техническое задание.

Кошелёк не просто **хранит** секрет. Он получает команды от потенциально заражённого компьютера, разбирает чужие бинарные форматы, показывает человеку смысл операции, ждёт физического подтверждения, выбирает правильный ключевой контекст и только затем разрешает криптографическое действие. Ошибка в любом переходе может быть важнее, чем выбор конкретного secure element.

Поэтому свой open-source проект [Hardware Wallet](https://github.com/Pom4H/hardware-wallet) я начал не с корпуса, экрана и даже не с Bitcoin. Я начал с вопроса:

> Какие инварианты должны оставаться истинными при любом блокчейне, любом транспорте и любой будущей плате?

Результат пока не является готовым устройством для реальных денег. Это экспериментальный reference device и проверяемая модель домена: маленькое chain-agnostic ядро на Rust, строгая граница доверия и несколько узких транзакционных сценариев, доведённых до end-to-end проверки в CI.

## Не флешка с ключами

Представим самый простой сценарий. Пользователь подключает устройство к ноутбуку и хочет отправить 0,1 ETH. Приложение на ноутбуке знает баланс, выбирает nonce, оценивает fee и формирует транзакцию. После этого оно просит аппаратный кошелёк поставить подпись.

Здесь легко незаметно сделать неверный архитектурный шаг: передать устройству уже «удобно разобранные» поля — сумму, адрес получателя и готовый digest — и показать их на экране. Получится чистый UI и короткий код. Но безопасность окажется декоративной.

Заражённое приложение может одновременно прислать:

- красивый текст «0,1 ETH для Алисы»;
- бинарную транзакцию на другой адрес;
- digest вообще от третьего payload;
- флаг `trusted: true`, который оно само себе назначило.

Если устройство подписывает digest, а экран показывает отдельную структуру данных, пользователь физически подтверждает не ту операцию, которая будет подписана.

В Hardware Wallet исходная предпосылка жёстче: **подключённый host не является источником истины**. USB-пакеты, transaction bytes, message bytes, correlation IDs и chain metadata считаются недоверенными. Host может запросить операцию, но не может объявить достоверными сумму, адрес, контрактный вызов, signing digest или собственный trust level.

<figure class="wide-figure">
  <img src="../figures/trust-boundary.svg" width="1600" height="900" alt="Граница доверия: недоверенный host передаёт сырой payload, а устройство само разбирает операцию, строит review и требует физическое подтверждение" loading="eager">
  <figcaption><strong>Рис. 1.</strong> Компьютер просит выполнить операцию. Смысл операции определяет устройство.</figcaption>
</figure>

Это не означает, что вся программа должна жить внутри защищённого микроконтроллера. Host всё ещё может хранить историю, искать UTXO, общаться с RPC и строить черновик транзакции. Но всё, что влияет на решение «что именно сейчас подпишет ключ», должно быть независимо проверено на доверенной стороне границы.

## Ядро не должно знать, что такое Bitcoin

Вторая ловушка появляется, когда аппаратный кошелёк постепенно превращается в каталог блокчейнов:

```text
if chain == Bitcoin { ... }
if chain == Ethereum { ... }
if chain == Solana { ... }
```

Сначала это кажется практичным. Затем правила авторизации, жизненный цикл, UI review и обработка ошибок начинают дублироваться в каждом приложении. Исправление security-инварианта приходится переносить во все chain modules, а новая сеть затрагивает всё устройство.

В Hardware Wallet граница проведена иначе.

**Generic core** отвечает за то, что одинаково для любого кошелька:

- provisioning и recovery;
- PIN, passphrase и состояние блокировки;
- pairing и доверие к host;
- сессии и их expiry;
- wallet contexts и accounts;
- security policy;
- review lifecycle;
- физическое подтверждение;
- correlation IDs, cancellation и stale callbacks;
- factory reset, tamper и wipe flow.

**Chain adapter** отвечает за то, что действительно зависит от протокола:

- разбор исходного payload;
- проверку derivation path;
- вычисление полей для human review;
- правила хеширования;
- схему подписи;
- сериализацию итогового wire artifact.

<figure class="wide-figure">
  <img src="../figures/architecture.svg" width="1600" height="900" alt="Архитектура Hardware Wallet: host, device protocol, chain adapter, review, generic wallet core и isolated runtime" loading="lazy">
  <figcaption><strong>Рис. 2.</strong> Chain-specific код объясняет операцию. Generic core решает, можно ли её выполнить.</figcaption>
</figure>

Chain adapter не получает права самовольно подписать данные. Он сначала превращает сырую операцию в `ReviewPlan`: тип операции, уровень достоверности review, необходимость private-key material и минимальное требуемое взаимодействие с человеком. Ядро может только **усилить** эти требования, но не ослабить их.

Например, adapter может сказать: «Это fully reviewed transfer, для исполнения нужен приватный ключ». Core добавит обязательное физическое подтверждение. Если adapter способен показать лишь ограниченную информацию, policy может запретить операцию. Если review слепой, операция по умолчанию отклоняется.

Новый блокчейн поэтому должен добавляться вокруг ядра, а не внутрь него. В core не должно появляться ни одной ветки `if bitcoin`, `if ethereum` или `if solana`.

## State + Event → State + Effect

Сердце проекта — чистый `no_std` reducer:

```text
State + Event → State + Effect
```

`State` содержит текущее несекретное состояние домена. `Event` сообщает, что произошло: пришёл запрос на unlock, backend проверил PIN, пользователь подтвердил review, persistence завершилась ошибкой, host отключился. Reducer вычисляет новое состояние и, если нужна внешняя работа, возвращает `Effect`.

Effect — это не результат. Это строго типизированная просьба к runtime:

- проверить PIN;
- разрешить trust level host;
- показать review на дисплее;
- сохранить настройку;
- очистить transient secrets;
- вывести public key;
- выполнить hash или signature operation.

Runtime выполняет effect и возвращает результат обратно как новый event. Таким образом, внешняя среда не может незаметно изменить внутреннее состояние. Каждый переход снова проходит через одну и ту же функцию домена.

<figure class="wide-figure">
  <img src="../figures/reducer-loop.svg" width="1600" height="900" alt="Детерминированный цикл: Event поступает в no_std reducer, reducer создаёт Effect, runtime исполняет его и возвращает Result Event" loading="lazy">
  <figcaption><strong>Рис. 3.</strong> Runtime владеет побочными эффектами; reducer владеет разрешёнными переходами.</figcaption>
</figure>

У этого решения есть несколько практических последствий.

Во-первых, тесты не обязаны эмулировать USB, экран и secure element, чтобы проверить security flow. Они подают события и сравнивают новое состояние с ожидаемыми effects.

Во-вторых, тот же domain code можно исполнять в host tests, firmware sandbox, co-simulation и позже на настоящей плате. Меняется runtime, а набор разрешённых переходов остаётся прежним.

В-третьих, асинхронность перестаёт быть скрытой. Проверка PIN, запись flash или подпись могут завершиться позже, но их completion event содержит correlation ID и принимается только тогда, когда соответствующий flow всё ещё активен.

## В state нет секрета — но это не маркетинговое обещание

В reducer state намеренно отсутствуют:

```text
seed
private key
PIN
passphrase
raw transaction
raw message
address bytes
chain-specific payload
```

Это не означает, что секрет уже физически гарантированно никогда не попадёт в MCU. Конкретный secure-element contract ещё не выбран, и проект прямо не делает такого заявления. Речь о более узком, но уже проверяемом свойстве: **доменная state machine не владеет secret bytes**.

Для операций с ключами core использует opaque identifiers. После PIN и optional passphrase secure runtime открывает конкретный `WalletContextId`. Это может быть базовый seed-wallet или скрытый passphrase-derived wallet, но reducer не знает секретное содержимое контекста.

Host также не передаёт `WalletContextId` вместе с запросом подписи. Он выбирает только относительный `KeyTarget`: account, derivation path и purpose. Лишь уже авторизованное состояние может создать `ExecutionContext`, который связывает target с текущим wallet context.

Получается capability boundary:

```text
untrusted KeyTarget
        +
ExecutionContext из Unlocked State
        ↓
    KeyLocator
```

Locked state не умеет выпустить такую capability. А pending operation запоминает контекст, в котором она была создана. Если пользователь открыл другой hidden wallet, старая review не может внезапно исполниться новым ключом.

## Один путь операции, семь контрольных точек

Полезнее всего рассмотреть архитектуру как последовательность остановок, а не как набор crates.

### 1. Host создаёт запрос

Host выбирает chain adapter и передаёт raw operation bytes через device protocol. У запроса есть opaque ID, но нет права самовольно классифицировать его как безопасный transfer.

### 2. Adapter разбирает исходные данные

Parser проверяет wire format и поддерживаемый subset. Если встретился неизвестный transaction class, adapter прекращает flow. «Я не умею это объяснить» здесь является корректным security result.

### 3. Устройство готовит review

Adapter строит поля, которые увидит пользователь, и указывает assurance: `Full`, `Limited` или `Blind`. Эти поля происходят из тех же raw bytes, которые позднее определят execution.

### 4. Core применяет policy

Core проверяет active session, host trust, wallet context, operation kind и security settings. Любая private-key operation автоматически получает требование explicit physical confirmation. Blind signing выключен по умолчанию.

### 5. Человек подтверждает на устройстве

Нажатие в desktop-приложении не подходит. Confirmation является device-owned event и относится к конкретному pending flow. Старое подтверждение с несовпадающим ID не двигает новый flow.

### 6. Adapter готовит `ChainExecution`

После approval adapter получает авторизованный `ExecutionContext`. Execution может быть многошаговым: вывести настоящий public key, проверить его соответствие transaction input, хешировать protocol-specific payload и лишь затем запросить signature.

Это важная деталь. Абстракция «дай мне подпись для этих 32 байт» слишком широкая: она переносит критическое решение о digest обратно на host. Многошаговый execution оставляет chain rules на доверенной стороне, но не загрязняет ими generic core.

### 7. Runtime исполняет crypto effects

Runtime работает с секретами в выбранной изолированной реализации и возвращает только результат, связанный с активным request. Если устройство успело заблокироваться, перезагрузиться или перейти в wipe flow, старый callback отвергается.

## Физическая кнопка — часть протокола

В аппаратном кошельке кнопка не является UI-украшением. Она разделяет два субъекта: host может сформировать запрос, но только человек рядом с устройством может разрешить private-key operation.

Поэтому правило сформулировано не как рекомендация для конкретного экрана, а как инвариант core:

> Ни одна операция с private-key material не исполняется без явного физического подтверждения.

Это правило распространяется и на custom chain operations. Нельзя добавить «универсальный» extension, пометить его нестандартным и тем самым обойти confirmation gate.

С настройками безопасности применяется ещё более строгая последовательность:

```text
request → render change → physical confirm → persist → apply
```

Даже после подтверждения пользователя policy ещё не меняется. Сначала runtime должен сообщить, что новая настройка надёжно сохранена. Если питание исчезнет между confirm и persistence, после reboot восстановится старая policy. Так host не может включить blind signing или изменить passphrase policy через гонку с отключением питания.

## Reboot должен уменьшать полномочия

Сохранить unlocked session после перезагрузки удобно. Но для reference architecture выбран безопасный и простой инвариант: provisioned wallet всегда возвращается в `Locked`.

Snapshot содержит только стабильные несекретные данные: создан ли wallet, каким способом он был восстановлен, проверен ли backup, какая passphrase policy включена. Session handles, wallet context handles и foreground flows не восстанавливаются.

<figure class="wide-figure">
  <img src="../figures/lifecycle.svg" width="1600" height="900" alt="Жизненный цикл кошелька: Empty, создание или восстановление, backup и PIN, persistence, Locked и Unlocked; reboot возвращает в Locked" loading="lazy">
  <figcaption><strong>Рис. 4.</strong> Перезагрузка сохраняет несекретные метаданные, но уничтожает временные полномочия.</figcaption>
</figure>

Эта модель автоматически закрывает неприятный класс ошибок. Completion от старой подписи, пришедший после reboot, больше не находит активного operation flow. Persistence callback от старой настройки не может воскресить удалённое состояние. Host после reconnect не захватывает предыдущую сессию.

Fail-closed здесь означает не «показать ошибку», а **не совершить переход**, если событие неизвестно, пришло не по порядку или содержит несовпадающий identifier.

## Зачем сразу Bitcoin, Ethereum и Solana

Сделать chain-agnostic интерфейс на одной сети легко: абстракция неизбежно будет похожа именно на эту сеть. Поэтому первыми probes стали три намеренно разные модели.

| Сеть | Проверяемая граница | Текущий полностью reviewed subset |
| --- | --- | --- |
| Bitcoin | UTXO, PSBT, BIP143, secp256k1 | PSBT v0, 1 input / 1 output, native P2WPKH, `SIGHASH_ALL` |
| Ethereum | account model, typed transaction, Keccak/secp256k1 | EIP-1559 native ETH transfer, пустые calldata и access list |
| Solana | message-oriented transaction, Ed25519 | legacy one-signer System Program transfer |

Это не список «поддерживаемых монет» для магазина. Каждый adapter реализует узкий эталонный маршрут и отклоняет всё, что пока не умеет полноценно разобрать и показать человеку.

Именно ограниченность здесь полезна. Она делает boundary наблюдаемой. Например, Ethereum adapter не должен без предупреждения пропускать arbitrary calldata только потому, что базовая сериализация уже работает. Bitcoin adapter не должен принимать любой PSBT, если проверяет лишь один P2WPKH input. Solana adapter не должен называть fully reviewed неизвестную instruction.

Три сети проверяют главный архитектурный тезис: новые transaction models можно добавлять без изменения wallet state machine.

## CI без faucet и публичного devnet

Unit tests способны доказать, что reducer отклоняет неверный transition. Но они не доказывают, что итоговый wire artifact действительно понимает Bitcoin Core, Anvil или Agave.

Для этой границы появился отдельный open-source проект [Chain Sandbox](https://github.com/Pom4H/chain-sandbox). Он поднимает одноразовые локальные сети за маленьким общим интерфейсом:

- Bitcoin Core 31.1 в режиме regtest;
- Anvil / Foundry 1.8.0;
- Agave 4.2.1 local validator.

<figure class="wide-figure">
  <img src="../figures/chain-sandbox.svg" width="1600" height="900" alt="GitHub Actions запускает отдельные локальные Bitcoin Core, Anvil и Agave nodes через Chain Sandbox и проверяет принятие транзакций" loading="lazy">
  <figcaption><strong>Рис. 5.</strong> Adapter проверяется не только против тестовых векторов, но и против настоящей локальной реализации протокола.</figcaption>
</figure>

Каждый chain adapter запускается в отдельном CI job. Workflow получает локальный `*_RPC_URL`, создаёт детерминированное состояние, формирует и подписывает поддерживаемую операцию, сравнивает wire artifacts там, где это имеет смысл, отправляет транзакцию и проверяет её принятие node.

Required CI поэтому не зависит от:

- доступности публичного RPC;
- rate limits;
- faucet;
- тестовых токенов;
- чужих API credentials;
- состояния общего devnet.

Chain Sandbox отвечает за установку, pinned versions, lifecycle процесса и readiness. Сам Hardware Wallet отвечает за business assertion: корректно ли разобрана, показана, подписана и принята конкретная операция.

Это разделение тоже является частью архитектуры. Инфраструктурный helper не должен знать, что именно доказывает wallet test, а wallet test не должен вручную воспроизводить запуск трёх разных node implementations.

## Что уже есть — и чего пока нет

На текущем этапе реализованы domain model, security invariants, generic key vocabulary, три узких adapter flow и end-to-end CI. Можно тестировать создание и восстановление wallet, backup verification, PIN lifecycle, passphrase contexts, pairing, lock/reboot behavior, review, confirmation, settings persistence, cancellation, stale callbacks, tamper и wipe transitions.

Целевое физическое направление пока описано лишь рамками:

- MCU Cortex-M class;
- дисплей 128×64;
- две физические кнопки;
- USB device transport;
- отдельный secure element;
- питание от USB без батареи.

Конкретный MCU не выбран. Контракт между MCU и secure element не заморожен. Поэтому проект не утверждает, что seed гарантированно никогда не попадает в MCU, не называется audited и не предлагается для хранения реальных средств.

Мне кажется, это важная часть open-source разработки security-sensitive систем: документировать не только свойства, которые хочется получить, но и точную границу уже доказанного.

Сейчас доказано, что generic core не владеет secret bytes, private-key operations проходят device-owned review и physical confirmation, сессии привязаны к host и wallet context, reboot отбрасывает временные полномочия, а узкие Bitcoin, Ethereum и Solana flows проходят через реальные локальные protocol implementations.

За пределами этой границы остаются физическая атака, supply chain, secure boot, firmware update protocol, production key ceremony, hardware entropy validation, side channels, UX recovery на реальном экране и независимый аудит. Это не мелкие детали «на потом», а следующие отдельные слои системы.

## Главный результат — не подпись

Самый заметный результат аппаратного кошелька — подписанная транзакция. Но наиболее ценный артефакт проекта сейчас находится раньше подписи: это набор переходов, в которых ни host, ни chain adapter, ни запоздалый callback не могут самостоятельно получить право использовать ключ.

Такой подход меняет порядок разработки. Сначала фиксируются trust boundaries и инварианты. Затем появляются adapters, runtime и hardware. Не наоборот.

Hardware Wallet остаётся экспериментом. Но уже сейчас он отвечает на важный инженерный вопрос: можно ли отделить безопасность кошелька от бесконечного каталога блокчейнов и проверить её как детерминированную state machine?

Первые три adapter говорят, что да.

---

### Исходники и проверяемая версия

- [Pom4H/hardware-wallet](https://github.com/Pom4H/hardware-wallet) — domain, chain API и adapters.
- [Domain invariants](https://github.com/Pom4H/hardware-wallet/blob/af1f103b0d7404178ab64b0f717f1af188bdd5fe/docs/DOMAIN.md) — состояние, lifecycle и правила переходов.
- [Security model](https://github.com/Pom4H/hardware-wallet/blob/af1f103b0d7404178ab64b0f717f1af188bdd5fe/docs/SECURITY.md) — trust boundaries и fail-closed rules.
- [Keys and cryptography](https://github.com/Pom4H/hardware-wallet/blob/af1f103b0d7404178ab64b0f717f1af188bdd5fe/docs/KEYS.md) — wallet contexts, key targets и execution capability.
- [Pom4H/chain-sandbox](https://github.com/Pom4H/chain-sandbox) — локальные Bitcoin, Ethereum и Solana nodes для CI.

Статья зафиксирована по commit [`af1f103`](https://github.com/Pom4H/hardware-wallet/tree/af1f103b0d7404178ab64b0f717f1af188bdd5fe) от 28 августа 2026 года.
