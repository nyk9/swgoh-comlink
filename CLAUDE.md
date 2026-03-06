# CLAUDE.md - プロジェクト概要

## プロジェクトの目的

SWGoH（Star Wars: Galaxy of Heroes）プレイヤーのキャラクター育成状況を元に、
今後の育成方針をAI（Claude API）がアドバイスするツールを開発する。

---

## ロードマップ

### Phase 1: 個人用CLI（現在のフォーカス）

- `bun run cli` のみで起動し、**対話型チャット**でアドバイスを受ける
- まずは **RotE（Rise of the Empire） TB特化** で実装する
- 動くものを最速で作ることを優先する
- **チャット形式のUXに全面改修済み**（下記「Phase 1 CLI チャット設計」参照）

### Phase 2: Discord bot（個人サーバー試験用）

- まず自分のDiscordサーバーに導入して動作確認・改善を繰り返す
- SWGoHギルドはほぼDiscordサーバーを持っているため相性が良い
- Phase 2で安定したらギルドのDiscordに導入してもらう形での展開を想定（Phase 3へ）
- **コマンド形式: スラッシュコマンド（`/advice` 等）**

#### Phase 2 開発ステップ

**Step 1: コマンド認識の確認**

- Discord botをセットアップしてスラッシュコマンドを登録する
- `/advice` コマンドを叩いたら固定の返事が返ってくることを確認する
- 目的: Discordとの疎通・コマンド登録の仕組みを確認する

**Step 2: Comlinkデータ取得の確認**

- `/advice allycode:445833733` でComlinkからデータを取得する
- AIに渡す用に整形したデータ（GP上位30キャラ等）をチャットに返す
- 目的: Comlink → Discord の一連のパイプラインを確認する

**Step 3: AIアドバイスまでの確認**

- モード・目的を引数で受け取り（例: `/advice allycode:445833733 mode:rote purpose:platoon`）
- `core/advisor` を呼び出してAIのアドバイスをチャットに返す
- 目的: CLI と同じ `core/` を Discord からも呼び出せることを確認する

### Phase 3: Web版（一般公開）

- Web開発経験あり
- ブラウザから誰でも使えるUIを作る

---

## アーキテクチャ概要

```
[bun run cli で起動]
  ↓
[アライコードを対話形式で入力（~/.swgoh-advisor/config.json に保存・再利用）]
  ↓
[Comlinkでプレイヤーデータ取得 → GP上位30キャラ + 手動JSONデータを整形]
  ↓
[モード選択（RotE TB / TW / GAC...）→ 目的選択（小隊/通常/スペシャル/GP上げ）]
  ↓
[システムプロンプト組み立て → Claude APIに投げる]
  ↓
[初回アドバイス表示 → 掘り下げチャット（/exit で終了）]
```

---

## データソース

| データ                                               | 取得方法                                         | 備考                                    |
| ---------------------------------------------------- | ------------------------------------------------ | --------------------------------------- |
| プレイヤーのキャラ育成状況（レリック数等）           | Comlink `/player` endpoint                       |                                         |
| スペシャルミッション・コンバットミッションの編成要件 | Comlink `territoryBattleDefinition` + `campaign` |                                         |
| 小隊（Platoon）に必要なキャラ一覧                    | **手動JSON管理**                                 | サーバー側管理のためComlinkでは取得不可 |
| アドバイス生成                                       | Claude API                                       |                                         |

---

## RotE TB アドバイス機能の設計方針

### AIに渡す情報（整形後）

生のJSONをそのまま渡すとトークン上限を超えるため、必要な情報だけ抽出・整形して渡す。

#### 1. 小隊（Platoon）情報

- 小隊で使うキャラクター一覧 + 必要レリック数
- **手動JSONで管理**（ゲームアップデート時に手動更新）

#### 2. スペシャルミッション情報

- スペシャルミッションで使うキャラ＋編成一覧 + 必要レリック数
- Comlinkの `territoryBattleDefinition` + `campaign` から取得

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

---

## リポジトリ構成

```
swgoh-comlink/
├── CLAUDE.md                    # このファイル（プロジェクト概要）
├── MEMO.md                      # 会話メモ・決定事項ログ
├── README.md                    # 元のComlink README
├── PRIVACY-STATEMENT.md         # プライバシーポリシー
├── docker-compose.yml           # Comlink起動用
│
├── packages/                    # 本番コード
│   ├── core/                    # 共通ロジック（CLI・Web・Discord共通）
│   │   ├── comlink/
│   │   │   ├── client.ts        # ComlinkへのHTTPリクエスト
│   │   │   ├── formatPlayer.ts  # プレイヤーデータ整形・GP上位N件抽出
│   │   │   ├── types.ts         # 型定義
│   │   │   └── index.ts
│   │   ├── advisor/
│   │   │   ├── client.ts        # AI呼び出し（continueChat・会話履歴対応）
│   │   │   ├── prompt.ts        # システムプロンプト組み立て
│   │   │   ├── providers.ts     # AIプロバイダー管理（Google / Anthropic）
│   │   │   └── index.ts
│   │   └── data/
│   │       ├── rote-platoons.json          # RotE TB 小隊情報（手動管理）
│   │       ├── rote-special-missions.json  # RotE TB スペシャルミッション（手動管理）
│   │       ├── roteData.ts      # 手動JSONの読み込み・集約
│   │       ├── types.ts         # 型定義
│   │       └── index.ts
│   │
│   ├── cli/                     # Phase 1: CLIアプリ（実装済み）
│   │   ├── index.ts             # エントリーポイント（bun run cli）
│   │   ├── chat.ts              # 対話ループ本体
│   │   ├── selector.ts          # 選択式UIユーティリティ
│   │   ├── config.ts            # ~/.swgoh-advisor/config.json 管理
│   │   └── modes/               # モード別選択肢定義
│   │       ├── rote.ts          # RotE TB
│   │       ├── tw.ts            # TW（スケルトン）
│   │       └── gac.ts           # GAC（スケルトン）
│   │
│   ├── discord/                 # Phase 2: Discord bot（未実装）
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
  → GP上位30キャラ + レリック値 を抽出
  → 手動JSONデータ（RotE要件等）も合わせて読み込む

③ モード選択（選択式）
  → 1) RotE TB  2) TW  3) GAC  ...

④ 目的選択（選択式・モードによって変わる）
  → 1) 小隊配置  2) 通常戦闘  3) スペシャルミッション  4) GP上げ全般  ...

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
- プレイヤー情報（GP上位30キャラ + レリック値）
- 手動JSONデータ（選択されたモードの要件・空でもOK）
- 選択されたモード・目的・補足

[会話履歴（軽量版・毎回積み上げる）]
- user / assistant のやり取りをそのまま渡す
- 将来的には「決定事項メモ管理」方式に移行予定
```

### 実装済みファイル構成

```
packages/
├── core/
│   ├── comlink/
│   │   └── formatPlayer.ts     # getTopNUnits() 追加済み
│   └── advisor/
│       ├── prompt.ts           # チャット用システムプロンプト（buildSystemPrompt / buildInitialUserMessage）
│       └── client.ts           # continueChat()・ChatMessage 型追加済み
│
└── cli/
    ├── index.ts                # チャットループ起動に全面改修済み
    ├── chat.ts                 # 対話ループ本体
    ├── selector.ts             # 選択式UIユーティリティ
    ├── config.ts               # ~/.swgoh-advisor/config.json 管理
    └── modes/                  # モード別選択肢定義
        ├── rote.ts             # RotE TB（小隊・通常・スペシャル・GP上げ）
        ├── tw.ts               # TW（スケルトン）
        └── gac.ts              # GAC（スケルトン）
```

### 拡張性の設計方針

- `modes/` 配下にファイルを1つ追加するだけで新モード対応
- アライコード保存は `packages/cli/config.ts` に閉じ込め（`core/` には触らない）
- 将来Bの「決定事項メモ管理」に移行する際は `client.ts` だけ変更すればOK

---

## 今後の次のアクション（Phase 1）

1. ~~**CLIチャット形式への改修**~~ ✅ 完了
2. ~~**GP上位30キャラ抽出**~~ ✅ 完了
3. **手動JSONへの実データ入力** - RotE TBの小隊・スペシャルミッション情報を入力する（← 残タスク）
   - `packages/core/data/rote-platoons.json`
   - `packages/core/data/rote-special-missions.json`

---

## インフラ・起動構成

### 各サービスの役割

| サービス        | 誰が動かすか        | 方法                                 |
| --------------- | ------------------- | ------------------------------------ |
| **Comlink**     | 自分（ローカル）    | `docker compose up`                  |
| **Claude API**  | Anthropicのサーバー | 何もしなくていい（外部サービス）     |
| **CLIアプリ**   | 自分                | コマンド実行（サーバー起動不要）     |
| **Discord bot** | 自分（Phase 2以降） | 別途起動 or docker-compose.ymlに追加 |
| **Webサーバー** | 自分（Phase 3以降） | 別途起動 or docker-compose.ymlに追加 |

### Phase 1（CLI）の起動手順

```
# 事前に一度だけ起動しておく
$ docker compose up -d   # ComlinkをDockerでバックグラウンド起動

# 使うたびに実行する（引数不要・チャット形式）
$ bun run cli
```

CLIは「実行したら終わるプログラム」なのでサーバー起動不要。
**Comlinkさえ起動していれば動く。**

### Phase 2以降の方針

- `docker-compose.yml` にWebサーバーやDiscord botを追加していく
- 最終的に `docker compose up` の1コマンドで全サービスが立ち上がる構成を目指す

### `docker-compose.yml` の現在の構成

| サービス名      | 役割                                         | 状態               |
| --------------- | -------------------------------------------- | ------------------ |
| `swgoh-comlink` | Comlink本体。プレイヤーデータ等を取得        | **使用中**         |
| `swgoh-stats`   | GP・スタット計算（`statCalcData/` を参照）   | 将来使う可能性あり |
| `swgoh-ae`      | Asset Explorer（キャラ画像等のアセット取得） | 今は不要           |
| `fake.help`     | 非推奨・コメントアウト済み                   | 不要               |

### `statCalcData/` について

`swgoh-stats` サービスがスタット計算に使うデータ。
TBアドバイスでスタットが必要になったときのために残しておく。
