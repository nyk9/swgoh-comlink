# CLAUDE.md - プロジェクト概要

## プロジェクトの目的

SWGoH（Star Wars: Galaxy of Heroes）プレイヤーのキャラクター育成状況を元に、
今後の育成方針をVercel AI SDK経由のAI（デフォルト: Google Gemini）がアドバイスするツールを開発する。

---

## ロードマップ

### Phase 1: 個人用CLI（現在のフォーカス）

- allyCodeを指定するとプレイヤーデータを取得し、アドバイスが返ってくる
- まずは **RotE（Rise of the Empire） TB特化** で実装する
- 動くものを最速で作ることを優先する

### Phase 2: Web版（一般公開）

- Web開発経験あり
- ブラウザから誰でも使えるUIを作る

### Phase 3: Discord bot（コミュニティ展開）

- SWGoHギルドはほぼDiscordサーバーを持っているため相性が良い
- ギルドのDiscordに導入してもらう形での展開を想定

---

## アーキテクチャ概要

```
[ユーザーがallyCode + 目的（RotE TB等）を指定]
  ↓
[Comlinkでプレイヤーデータ取得 → 必要な情報だけ抽出・整形]
  ↓
[手動JSON（Platoon情報等）と組み合わせ]
  ↓
[Vercel AI SDK経由でAI API（GoogleまたはAnthropic）に投げる]
  ↓
[アドバイス表示]
```

---

## データソース

| データ                                               | 取得方法                                         | 備考                                                                 |
| ---------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| プレイヤーのキャラ育成状況（レリック数等）           | Comlink `/player` endpoint                       |                                                                      |
| スペシャルミッション・コンバットミッションの編成要件 | Comlink `territoryBattleDefinition` + `campaign` |                                                                      |
| 小隊（Platoon）に必要なキャラ一覧                    | **手動JSON管理**                                 | サーバー側管理のためComlinkでは取得不可                              |
| アドバイス生成                                       | Vercel AI SDK（Google Gemini / Claude）          | デフォルトはGoogle Gemini（無料枠あり）。`--provider` で切替可能     |

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

- ユーザーがコマンドで目的（TB用・TW用・GAC用など）を指定
- 指定された目的に応じて渡すデータとプロンプトを切り替える

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
├── CLAUDE.md               # このファイル（プロジェクト概要）
├── MEMO.md                 # 会話メモ・未決事項
├── README.md               # 元のComlink README
├── package.json            # Bun workspaces設定
├── tsconfig.json           # TypeScript設定（共通）
├── .env.example            # 環境変数テンプレート
├── docker-compose.yml      # Comlink等のDocker設定
│
├── packages/
│   ├── core/               # 共通ロジック（CLI・Web・Discord共用）
│   │   ├── comlink/        # ComlinkAPIクライアント・整形
│   │   ├── advisor/        # AIアドバイス生成（Vercel AI SDK）
│   │   └── data/           # 手動JSON管理（Platoon情報等）
│   ├── cli/                # Phase 1: CLIアプリ
│   ├── web/                # Phase 2: Webアプリ（未実装）
│   └── discord/            # Phase 3: Discord bot（未実装）
│
├── api-test/               # APIテスト用スクリプト（自作）
│   ├── player.ts           # プレイヤーデータ取得テスト
│   └── player-*.json       # ⛔️ 実際のプレイヤーデータ（閲覧禁止）
└── statCalcData/           # スタット計算データ（swgoh-statsが使用）
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

## Phase 1 実装状況

### 完了済み

- [x] Step 1: monorepo初期セットアップ（Bun workspaces）
- [x] Step 2: Comlinkクライアント実装（`/player` endpoint）
- [x] Step 3: プレイヤーデータ整形（レリックレベル算出含む）
- [x] Step 4: RotE TB手動JSONスキーマ設計・読み込みロジック（テンプレートのみ）
- [x] Step 5: AIアドバイス生成（Vercel AI SDK、Google Gemini / Claude切替対応）
- [x] Step 6: CLIエントリーポイント実装

### 次のアクション

1. **`rote-platoons.json` の実データ投入** - 実際のRotE TBの小隊要件を手動で記入
2. **スペシャルミッション情報のComlink取得実装** - `territoryBattleDefinition` + `campaign` から取得するロジックを実装
3. **プロンプト改善** - 実際にアドバイスを試しながら反復改善

---

## インフラ・起動構成

### 各サービスの役割

| サービス        | 誰が動かすか        | 方法                                 |
| --------------- | ------------------- | ------------------------------------ |
| **Comlink**     | 自分（ローカル）    | `docker compose up`                  |
| **Claude API**  | Anthropicのサーバー | 何もしなくていい（外部サービス）     |
| **CLIアプリ**   | 自分                | コマンド実行（サーバー起動不要）     |
| **Webサーバー** | 自分（Phase 2以降） | 別途起動 or docker-compose.ymlに追加 |
| **Discord bot** | 自分（Phase 3以降） | 別途起動 or docker-compose.ymlに追加 |

### Phase 1（CLI）の起動手順

```
# 事前に一度だけ起動しておく
$ docker compose up -d   # ComlinkをDockerでバックグラウンド起動

# 使うたびに実行する
$ bun run packages/cli/index.ts 445833733 --tb rote

# AIプロバイダーを切り替える場合（デフォルト: Google Gemini）
$ bun run packages/cli/index.ts 445833733 --tb rote --provider anthropic
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
