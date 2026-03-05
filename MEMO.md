# プロジェクトメモ

このファイルは会話の中で出てきた重要な気づき・決定事項・疑問点を記録するためのメモです。
詳細な設計・方針は `CLAUDE.md` を参照してください。

---

## 決定事項ログ

### 2025 - プロジェクト方針

- **目的**: SWGoHプレイヤーの育成状況からAIが育成方針をアドバイスするツール
- **AIサービス**: Claude API（Anthropic）を使用
- **まず**: RotE TB特化でPhase 1を作る
- **Platoon情報**: Comlinkでは取得不可（サーバー側管理）→ 手動JSONで管理する（許容済み）
- **生JSONをそのままAIに渡さない**: トークン上限を超えることを確認済み → 整形が必要

### インターフェースのロードマップ

- Phase 1: 個人用CLI
- Phase 2: Web版（Next.js、もしくは会社で使うフレームワーク）
- Phase 3: Discord bot（SWGoHコミュニティとの相性が良いため）

### 技術選択（確定）

- **全Phase共通: TypeScript + Bun**
  - RustはCPUフル回転の処理で真価を発揮するが、このツールの処理の99%はネットワーク待ち（Comlink API・Claude API）なので速度差はほぼ出ない
  - TypeScriptに統一することで `core/` を全Phaseで共有できる
  - Vibe Coding（GitHub Copilot + Claude Code）との相性も良い
- **monorepo構成**（`packages/` にまとめる）
  - 1つのリポジトリにCLI・Web・Discordをまとめて管理する構成
  - `core/` の共通ロジックをCLI・Web・Discordで共有できる

### `core/` の共有の仕組み

- 普段Next.jsで `lib/` に関数を置いてimportするのと本質的に同じ
- Phase 1（CLI）では相対パスで直接importするだけでOK
  ```
  import { fetchPlayerData } from "../../core/comlink/index.ts"
  ```
- Phase 2（Next.js）との連携は2通りのやり方がある
  - A: 相対パスで直接import（設定ほぼ不要）
  - B: パッケージとして登録してimport（`@swgoh-advisor/core` のような形）
- **Next.jsとの連携はPhase 2になってから考えれば十分**
- `core/` の関数はNext.jsのサーバーサイドでのみ使う（Claude APIキーをブラウザに露出させないため）

### インフラ

- ComlinkはDockerで起動（`docker compose up -d`）
- Claude APIはAnthropic外部サービスなので自分で起動不要
- Phase 2以降は `docker-compose.yml` にWebサーバー・Discord botを追加していく方針

---

## 疑問・確認済み事項

### Comlink利用規約について（確認済み・問題なし）

- ComlinkはツールやサービスをつくるためのものなのでOK
- 返されるデータはすべてパブリック情報
- EAのToSを守ること（読み取り専用・レートリミット遵守・アカウント操作なし）

### Platoon情報がComlinkで取れない件（確認済み）

- `territoryBattleDefinition` に小隊情報は含まれない
- FAQにも「All running Territory Battle information is locked behind user authorization」と明記
- 対応策: 手動JSONで管理（ゲームアップデート時に手動更新）

---

## 気になっていること・あとで調べること

- [ ] `territoryBattleDefinition` と `campaign` から実際にどこまでスペシャルミッション情報が取れるか実験する
- [ ] プレイヤーデータ（`/player`）の整形：どのフィールドを抽出するか決める
- [ ] RotE TBの手動JSON設計：小隊情報をどう構造化するか
- [ ] Claude APIへのプロンプト設計：どう渡すと良いアドバイスが返るか

---

## ディレクトリ構成メモ

```
swgoh-comlink/
├── CLAUDE.md                    # プロジェクト概要・設計方針（詳細はこちら）
├── MEMO.md                      # このファイル（会話メモ）
├── README.md                    # 元のComlink README
├── PRIVACY-STATEMENT.md         # プライバシーポリシー
├── docker-compose.yml           # Comlink起動用
│
├── packages/                    # 本番コード
│   ├── core/                    # 共通ロジック（CLI・Web・Discord共通）
│   │   ├── comlink/             # ComlinkのAPIクライアント
│   │   ├── advisor/             # AIアドバイス生成ロジック
│   │   └── data/                # 手動JSON（Platoon情報等）
│   │
│   ├── cli/                     # Phase 1: CLIアプリ
│   ├── web/                     # Phase 2: Webアプリ
│   └── discord/                 # Phase 3: Discord bot
│
├── api-test/                    # APIテスト・調査用スクリプト
│   └── player-*.json            # ⛔️ 実際のプレイヤーデータ（閲覧禁止）
└── statCalcData/                # スタット計算データ（swgoh-statsが使用）
```

> **⛔️ 重要: `api-test/player-*.json` は実際のプレイヤーデータが含まれる実データファイルです。
> AIアシスタント（Claude等）はこれらのファイルを絶対に読み込まないこと。**

---

## `core/` の役割メモ

CLI・Web・Discord botで**同じ処理**が必要になるため、共通ロジックを `core/` にまとめる。

```
[CLI]      ┐
[Web]      ├─→ core/ （共通処理）─→ Comlink API / Claude API
[Discord]  ┘
```

- `core/comlink/` : ComlinkへのHTTPリクエスト・レスポンス整形
- `core/advisor/` : Claude APIへのプロンプト生成・レスポンス整形
- `core/data/` : 手動管理の静的データ（RotE TB小隊情報等）

---

## 次回やること

- Claude Code用の設定(MCPやSkills, プロンプト系)
- GitHub Copilot用の設定(MCPやSkills, プロンプト系)

---

## Phase 1 開発計画

### ステップ一覧

#### Step 1: monorepo 初期セットアップ (`feat/step1-monorepo-setup`)

- ルートに `package.json`（Bun workspaces設定）と `tsconfig.json` を作成
- `packages/core/package.json` と `packages/cli/package.json` を作成
- 各パッケージの `tsconfig.json` を作成

#### Step 2: `core/comlink` — Comlinkクライアント実装 (`feat/step2-comlink-client`)

- `packages/core/comlink/client.ts` : `/player` へのHTTPリクエスト関数
- `packages/core/comlink/types.ts` : レスポンスの型定義（最低限）
- 入力: `allyCode: string` → 出力: 生のプレイヤーJSON

#### Step 3: `core/comlink` — プレイヤーデータ整形 (`feat/step3-player-formatter`)

- `packages/core/comlink/formatPlayer.ts` : 生JSONから必要フィールドだけ抽出
- 抽出対象（暫定）: キャラ名・レリックレベル・ギアレベル・スター数
- RotE TB関連キャラに絞ってフィルタ

#### Step 4: `core/data` — RotE TB 手動JSON設計・作成 (`feat/step4-rote-data`)

- `packages/core/data/rote-platoons.json` : 小隊情報（キャラID + 必要レリック数）
- `packages/core/data/rote-special-missions.json` : スペシャルミッション情報
- ゲームアップデート時に手動更新する運用

#### Step 5: `core/advisor` — Claude API プロンプト生成・呼び出し (`feat/step5-advisor`)

- `packages/core/advisor/prompt.ts` : RotE TB用プロンプトを組み立てる関数
- `packages/core/advisor/client.ts` : Claude APIを呼び出す関数
- `.env` に `ANTHROPIC_API_KEY` を設定する運用

#### Step 6: `packages/cli` — CLIエントリーポイント実装 (`feat/step6-cli`)

- `packages/cli/index.ts` : `bun run cli 445833733 --tb rote` で動くCLI
- Step 2〜5を組み合わせてパイプラインを完成させる

### 開発順序

```
Step 1（土台）
  → Step 2（データ取得）
  → Step 3（整形）＋ Step 4（手動JSON）  ← 並行可能
  → Step 5（AI呼び出し）
  → Step 6（CLIで全部つなぐ）
```

### 判断が必要な点（実装時に確認）

- **Step 3**: 実際のプレイヤーJSONを見てレリック情報のフィールド名を確認する
- **Step 4**: RotE TBの小隊・スペシャルミッションのキャラ一覧をゲーム知識を元に手動で整理する
- **Step 5**: Claude APIを叩きながらプロンプトを反復して改善する
