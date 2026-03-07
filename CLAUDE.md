# CLAUDE.md - プロジェクト概要

## プロジェクトの目的

SWGoH（Star Wars: Galaxy of Heroes）プレイヤーのキャラクター育成状況を元に、
今後の育成方針をAI（Claude API）がアドバイスするツールを開発する。

---

## ロードマップ

### Phase 1: 個人用CLI ✅ 完了

- `bun run cli` のみで起動し、**対話型チャット**でアドバイスを受ける
- まずは **RotE（Rise of the Empire） TB特化** で実装する
- **チャット形式のUXに全面改修済み**

### Phase 2: Discord bot（個人サーバー試験用）✅ 完了

- まず自分のDiscordサーバーに導入して動作確認・改善を繰り返す
- SWGoHギルドはほぼDiscordサーバーを持っているため相性が良い
- Phase 2で安定したらギルドのDiscordに導入してもらう形での展開を想定（Phase 3へ）
- **コマンド形式: スラッシュコマンド（`/advice` 等）**

#### Phase 2 開発ステップ（全完了）

**Step 1: コマンド認識の確認** ✅

- Discord botをセットアップしてスラッシュコマンドを登録
- `/advice` コマンドを叩いたら固定の返事が返ってくることを確認

**Step 2: Comlinkデータ取得の確認** ✅

- `/advice allycode:445833733` でComlinkからデータを取得
- AIに渡す用に整形したデータ（GP上位30キャラ等）をチャットに返す

**Step 3: AIアドバイスまでの確認** ✅

- `mode` / `purpose` 引数を受け取り（例: `/advice allycode:445833733 mode:rote purpose:platoon`）
- `core/advisor` を呼び出してAIのアドバイスをチャットに返す

#### Phase 2 次のアクション

- **スレッドでの会話継続対応**（現在は1回答えて終わり）
  - `/advice` を叩いたらスレッドを自動作成し、そのスレッド内でチャットを継続できるようにする

### Phase 3: Web版（一般公開）

- Web開発経験あり
- ブラウザから誰でも使えるUIを作る

---

## アーキテクチャ概要

```
[bun run cli で起動 / Discord /advice コマンド]
  ↓
[アライコードを入力（CLI: config.json保存 / Discord: コマンド引数）]
  ↓
[Comlinkでプレイヤーデータ取得 → R5以上全キャラ + 手動JSONデータを整形]
  ↓
[モード選択（RotE TB / TW / GAC...）→ 目的選択（小隊/通常/スペシャル/ギルド報酬の向上）]
  ↓
[システムプロンプト組み立て → AI APIに投げる]
  ↓
[初回アドバイス表示 → 掘り下げチャット（CLI: /exit で終了 / Discord: スレッドで継続）]
```

---

## データソース

| データ                                                 | 取得方法                                                   | 備考                                    |
| ------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------- |
| プレイヤーのキャラ育成状況（レリック数等）             | Comlink `/player` endpoint                                 |                                         |
| スペシャルミッション・属性限定戦闘ミッションの編成要件 | Comlink `territoryBattleDefinition` + `campaign`           | `rote-special-missions.json` で統合管理 |
| 小隊（Platoon）に必要なキャラ一覧                      | **手動JSON管理**                                           | サーバー側管理のためComlinkでは取得不可 |
| GL イベント（Jabba等）の参加条件・Tier 要件            | Comlink `/data segment:4` → `campaign > EVENTS > GALACTIC` | ✨ NEW: 自動取得・自動判定機能実装済み  |
| アドバイス生成                                         | AI API（Google Gemini / Anthropic Claude）                 |                                         |

---

## Galactic Legend (GL) イベント対応

### 実装済み機能（2025-01）

**Comlink から全 GL イベント情報を自動取得・判定する機能を実装しました。**

対応している GL イベント（全10種類）:

- **Jabba the Hutt** (5 Tier)
- **Rey** (6 Tier)
- **Kylo Ren** (6 Tier)
- **Luke Skywalker** (6 Tier)
- **Sith Eternal Emperor** (6 Tier)
- **Kenobi** (6 Tier)
- **Darth Vader** (6 Tier)
- **Leia Organa** (6 Tier)
- **Ahsoka Tano** (6 Tier)
- **Hondo Ohnaka** (6 Tier)

### 取得できるデータ

各 GL イベントの Tier ごとに以下の情報を Comlink から自動抽出：

- **必須キャラ** (mandatoryUnitIds)
- **参加可能なカテゴリタグ** (categoryIds)
- **最低スター数**
- **最低レリックレベル**
- **編成人数の制限** (最小・最大)

### AIアドバイスへの活用予定

現在実装済みのデータ取得・判定機能を、adviser システムプロンプトに組み込むことで：

- 「Jabba GL を解放するには何が足りないか」を自動判定
- プレイヤーの現状に応じた育成優先順位をアドバイス
- 他の GL イベントへも同様に対応

### 技術詳細

- `parseGLEventData()` : Comlink データから GL イベント要件を抽出
- `fetchGLEventData()` : GL イベント情報を取得（キャッシュ付き）
- `checkGLEventRequirements()` : プレイヤーのクリア可能状況を判定

---

## RotE TB アドバイス機能の設計方針

### AIに渡す情報（整形後）

生のJSONをそのまま渡すとトークン上限を超えるため、必要な情報だけ抽出・整形して渡す。

#### 1. 小隊（Platoon）情報

- 小隊で使うキャラクター一覧 + 必要レリック数
- **手動JSONで管理**（ゲームアップデート時に手動更新）

#### 2. スペシャルミッション情報

- スペシャルミッションで使うキャラ＋編成一覧 + 必要レリック数 + クリア報酬
- `rote-restricted-missions.json` で手動管理（スペシャル＋属性限定戦闘ミッションを統合）
- `SpecialMission` 型に `rewards?: SpecialMissionReward[]` フィールドあり（実データ入力中）

#### 3. 通常ミッション情報（後回し）

- 通常ミッションで使える編成一覧
- 後のフェーズで対応予定

#### 4. プレイヤーの現状

- 上記キャラを自分がどれだけ育てているか（レリック数など）
- Comlinkの `/player` endpoint から取得・整形

### AIへのアドバイス依頼の形式

- CLIチャット起動後、対話形式でモード（RotE TB / TW / GAC）と目的を選択する
- 選択された目的に応じてシステムプロンプトを組み立て、AIに渡す
- 初回アドバイス後は自由入力で掘り下げ質問ができる（/exit で終了）

---

## 技術的な注意点

- **Platoon情報はComlinkでは取得不可**
  - `territoryBattleDefinition` に小隊情報は含まれない（サーバー側管理）
  - FAQ引用: _"All running Territory Battle information... is locked behind user authorization"_
- **生JSONをそのままAIに渡さない**
  - プレイヤーデータは非常に大きく、トークン上限を超える
  - 必要なフィールドだけ抽出・整形してから渡す
- **レートリミット**
  - Capital Gamesのポリシーに依存（概ね ~20 req/sec）
  - `/player` と `/playerArena` は ~100 req/sec
- **ComlinkのAPIフィールド名に注意**
  - スター数は `rarity` ではなく `currentRarity`
  - GP は `rosterUnit` には存在しない → `profileStat` から取得する

---

## リポジトリ構成

```
swgoh-comlink/
├── CLAUDE.md                    # このファイル（プロジェクト概要）
├── MEMO.md                      # 会話メモ・決定事項ログ
├── README.md                    # 元のComlink README
├── PRIVACY-STATEMENT.md         # プライバシーポリシー
├── docker-compose.yml           # Comlink + Discord bot 起動用
├── .dockerignore                # Dockerビルド除外設定
│
├── packages/                    # 本番コード
│   ├── core/                    # 共通ロジック（CLI・Web・Discord共通）
│   │   ├── comlink/
│   │   │   ├── client.ts                      # ComlinkへのHTTPリクエスト
│   │   │   ├── formatPlayer.ts                # プレイヤーデータ整形・GP上位N件抽出
│   │   │   ├── fetchGameData.ts               # /data segment取得（segment:2,4）
│   │   │   ├── fetchRoteData.ts               # RotE TBデータ取得（キャッシュ付き）
│   │   │   ├── fetchGLEventData.ts            # GL イベントデータ取得（キャッシュ付き）✨ NEW
│   │   │   ├── parseRoteData.ts               # RotE TBデータパーサー
│   │   │   ├── parseGLEventData.ts            # GL イベントデータパーサー ✨ NEW
│   │   │   ├── checkGLEventRequirements.ts    # GL イベント参加条件判定 ✨ NEW
│   │   │   ├── types.ts                       # 型定義
│   │   │   └── index.ts
│   │   ├── advisor/
│   │   │   ├── client.ts        # AI呼び出し（continueChat・会話履歴対応）
│   │   │   ├── prompt.ts        # システムプロンプト組み立て
│   │   │   ├── providers.ts     # AIプロバイダー管理（Google / Anthropic）
│   │   │   └── index.ts
│   │   └── data/
│   │       ├── rote-platoons.json            # RotE TB 小隊情報（手動管理・実データ未入力）
│   │       ├── rote-restricted-missions.json # RotE TB スペシャル＋属性限定戦闘ミッション（手動管理・実データ入力中）
│   │       ├── roteData.ts      # 手動JSONの読み込み・集約
│   │       ├── types.ts         # 型定義
│   │       └── index.ts
│   │
│   ├── cli/                     # Phase 1: CLIアプリ ✅ 実装済み
│   │   ├── index.ts             # エントリーポイント（bun run cli）
│   │   ├── chat.ts              # 対話ループ本体
│   │   ├── selector.ts          # 選択式UIユーティリティ
│   │   ├── config.ts            # ~/.swgoh-advisor/config.json 管理
│   │   └── modes/               # モード別選択肢定義
│   │       ├── rote.ts          # RotE TB
│   │       ├── tw.ts            # TW（スケルトン）
│   │       └── gac.ts           # GAC（スケルトン）
│   │
│   ├── discord/                 # Phase 2: Discord bot ✅ 実装済み
│   │   ├── index.ts             # エントリーポイント（bun run discord）
│   │   ├── deploy-commands.ts   # スラッシュコマンド登録スクリプト
│   │   ├── Dockerfile           # Discord bot コンテナ定義
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── commands/
│   │       └── advice.ts        # /advice コマンド定義・ハンドラー
│   │
│   └── web/                     # Phase 3: Webアプリ（未実装）
│
├── api-test/                    # APIテスト・調査用スクリプト
│   └── player-*.json            # ⛔️ 実際のプレイヤーデータ（閲覧禁止）
└── statCalcData/                # スタット計算データ（swgoh-statsが使用）
```

> **⛔️ 重要: `api-test/player-*.json` は実際のプレイヤーデータが含まれる実データファイルです。
> AIアシスタント（Claude等）はこれらのファイルを絶対に読み込まないこと。**

---

## ドキュメント構成

| ファイル    | 用途                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `CLAUDE.md` | プロジェクトの設計・方針・技術的な決定事項をまとめた技術ドキュメント |
| `MEMO.md`   | 会話の中で出てきた気づき・未決事項・メモを残すためのファイル         |

---

## Phase 1 CLI チャット設計

### 起動フロー

```
起動: bun run cli

① アライコード確認
  [初回]    → 「アライコードを入力してください（9桁）: 」→ 保存
  [2回目以降] → 「前回のアライコード: 445833733 で続けますか？ [Y/n]: 」
               Y(Enter) → そのまま使用 / n → 新しいアライコードを入力して保存

② プレイヤーデータ取得・整形
  → R5以上全キャラ + レリック値 を抽出
  → 手動JSONデータ（RotE要件等）も合わせて読み込む

③ モード選択（選択式）
  → 1) RotE TB  2) TW  3) GAC  ...

④ 目的選択（選択式・モードによって変わる）
  → 1) 小隊配置  2) 通常戦闘  3) スペシャルミッション  4) ギルド報酬の向上  ...

⑤ 自由追記（任意）
  → 「補足があれば入力してください（Enterでスキップ）: 」

⑥ 初回アドバイス表示

⑦ 掘り下げチャット（自由入力）
  → 会話履歴を保持してAIと往復
  → /exit で終了
```

### アライコードの保存先

- `~/.swgoh-advisor/config.json`（ホームディレクトリ）
- CLI専用の関心事として `packages/cli/config.ts` に閉じ込める（`core/` には含めない）
- Web・Discordではそれぞれのセッション/DBで管理する

### システムプロンプトの構成

```
[システムプロンプト（セッション開始時に1回組み立てる）]
- SWGoH専門家としての役割定義
- プレイヤー情報（R5以上全キャラ + レリック値）
- 手動JSONデータ（選択されたモードの要件・空でもOK）
- 選択されたモード・目的・補足
- purpose別ガイドライン（ROTE_PURPOSE_CONFIG から自動挿入）

[会話履歴（軽量版・毎回積み上げる）]
- user / assistant のやり取りをそのまま渡す
- 将来的には「決定事項メモ管理」方式に移行予定
```

#### purpose別ガイドラインの設計方針

`packages/core/advisor/prompt.ts` の `ROTE_PURPOSE_CONFIG` に各purposeの定義を一元管理している。
purposeを追加・変更する場合はここだけ編集すればよい。

| フィールド       | 用途                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `label`          | CLI・Discordの選択肢UI表示名（`ROTE_PURPOSE_LABELS` でエクスポート） |
| `guidelines`     | システムプロンプトの「アドバイスの方針」に追加する目的固有の指示     |
| `initialMessage` | セッション開始時にAIへ送る最初のユーザーメッセージ                   |

---

## Phase 2 Discord bot 設計

### コマンド仕様

```
/advice allycode:<9桁> [mode:<rote|tw|gac>] [purpose:<platoon|combat_mission|special_mission|guild_rewards>] [show_prompt:<true|false>]
```

- `allycode`: 必須。プレイヤーのアライコード
- `mode`: 省略時はプレイヤーデータの表示のみ
- `purpose`: `mode:rote` のときのみ有効。省略時は `platoon` がデフォルト
  - `platoon`: 小隊配置（Platoon）の最大化
  - `combat_mission`: 通常戦闘ミッションへの貢献
  - `special_mission`: スペシャルミッションのクリア
  - `guild_rewards`: ギルド報酬の向上（小隊・CM・SMの3軸でTPと追加報酬を最大化）
- `show_prompt`: [DEBUG] AIに渡したシステムプロンプトをスレッド内に出力する

### 動作フロー

```
① /advice コマンド受信
  → interaction.deferReply()（処理中表示）

② Comlinkからプレイヤーデータ取得・整形（R5以上全キャラ）

③ mode が指定されていない場合
  → GP上位キャラのデータをテキスト表示して終了

④ mode が指定されている場合
  → core/advisor を呼び出してAIアドバイスを生成
  → 2000文字超の場合はメッセージを分割して送信（editReply + followUp）

⑤ スレッドを自動作成して会話継続
  → スレッドIDをキーにセッション（システムプロンプト + 会話履歴）をメモリ管理
  → スレッド内のメッセージイベントを購読してBotが返答し続ける
  → セッションTTLは1時間（Bot再起動でリセット）
```

### COMLINK_URL について

- ローカル実行時: `http://localhost:5001`（デフォルト）
- Docker コンテナ内: `COMLINK_URL=http://swgoh-comlink:3000`（環境変数で上書き）

---

## 今後の次のアクション

1. **手動JSONへの実データ入力**（← 継続残タスク）
   - `packages/core/data/rote-platoons.json`（小隊情報・実データ未入力）
   - `packages/core/data/rote-restricted-missions.json`（スペシャル＋属性限定戦闘ミッション・実データ入力中）
   - `SpecialMission.rewards` フィールドへのSMクリア報酬データ入力（型定義済み・実データ未入力）

2. **アドバイス精度の継続改善**
   - 手動JSONの実データを充実させてAIへの情報精度を上げる
   - Discord上でのデバッグ・テストを継続（`show_prompt` オプション活用）
   - プロンプトのチューニング（RotE TBのTP/星数/報酬メカニズムを正確に伝える）

3. **Phase 3: Web版の設計・実装**

---

## インフラ・起動構成

### 各サービスの役割

| サービス        | 誰が動かすか        | 方法                                 |
| --------------- | ------------------- | ------------------------------------ |
| **Comlink**     | 自分（ローカル）    | `docker compose up`                  |
| **AI API**      | 外部サービス        | 何もしなくていい                     |
| **CLIアプリ**   | 自分                | コマンド実行（サーバー起動不要）     |
| **Discord bot** | 自分                | `docker compose up`                  |
| **Webサーバー** | 自分（Phase 3以降） | 別途起動 or docker-compose.ymlに追加 |

### 起動手順

```
# Comlink + Discord bot を両方まとめて起動
$ docker compose up -d

# CLI（使うたびに実行）
$ bun run cli

# スラッシュコマンドの登録（コマンド変更時のみ）
$ bun run deploy-commands
```

### `docker-compose.yml` の現在の構成

| サービス名      | 役割                                         | 状態               |
| --------------- | -------------------------------------------- | ------------------ |
| `swgoh-comlink` | Comlink本体。プレイヤーデータ等を取得        | **使用中**         |
| `discord-bot`   | Discord bot本体（スレッド会話継続対応済み）  | **使用中**         |
| `swgoh-stats`   | GP・スタット計算（`statCalcData/` を参照）   | 将来使う可能性あり |
| `swgoh-ae`      | Asset Explorer（キャラ画像等のアセット取得） | 今は不要           |
| `fake.help`     | 非推奨・コメントアウト済み                   | 不要               |

### `statCalcData/` について

`swgoh-stats` サービスがスタット計算に使うデータ。
TBアドバイスでスタットが必要になったときのために残しておく。
