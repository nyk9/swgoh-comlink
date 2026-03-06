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
- Phase 2: Discord bot（個人サーバーで試験運用 → ギルドへ展開）✅ 基本実装完了
  - コマンド形式: スラッシュコマンド（`/advice` 等）
  - Step 1: コマンド認識の確認（固定返答が返ってくるか）✅
  - Step 2: Comlinkデータ取得の確認（整形データがチャットに返ってくるか）✅
  - Step 3: AIアドバイスまでの確認（`core/advisor` を Discord から呼び出せるか）✅
  - Step 4: スレッドでの会話継続対応（← 次のアクション）
- Phase 3: Web版（一般公開・Next.js等）

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
- AI APIは外部サービスなので自分で起動不要
- Discord botも `docker-compose.yml` に追加済み → `docker compose up -d` 1コマンドで起動
- Phase 3以降は `docker-compose.yml` にWebサーバーを追加していく方針

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
- [x] プレイヤーデータ（`/player`）の整形：どのフィールドを抽出するか決める → 完了（GP上位30キャラ + レリック値）
- [x] RotE TBの手動JSON設計：小隊情報をどう構造化するか → 完了（スキーマ設計済み・実データ入力は残タスク）
- [x] Claude APIへのプロンプト設計：どう渡すと良いアドバイスが返るか → チャット形式のシステムプロンプトとして実装済み

---

## アドバイス精度問題（Phase 1 動作テスト後）

### 問題

手動テストでCLIは動作したが、アドバイス内容の精度が非常に悪かった。
AIがゲーム一般論（「CLSチームを作れ」等）を回答しており、実際のプレイヤーの育成状況が全く反映されていなかった。

### 根本原因

**`rote-platoons.json` と `rote-special-missions.json` に実データが入力されていない（テンプレートのまま）**

全ユニットIDが `"UNIT_ID_HERE"` のプレースホルダーのままのため、以下の連鎖が起きていた：

1. `getAllRoteUnitIds()` が返すIDが `["UNIT_ID_HERE"]` のみ
2. `filterUnitsByIds()` でRotE関連キャラを一切取得できない（フィルタ結果が空）
3. AIに渡すプロンプトの「要件未達キャラ」が空 or 意味のない値になる
4. AIが実データ不足を察知して一般論でハルシネーション回答

AIのレスポンスに「提供いただいたデータではキャラクター育成が初期段階」「要件達成済み0」と出ていたのはこのため。

### 対策方針（決定済み）

**アプローチA: 手動JSONに実データを入力する**（根本解決）

- `packages/core/data/rote-platoons.json` にRotE TBの小隊情報（キャラID + 必要レリックレベル）を入力する
- `packages/core/data/rote-special-missions.json` にスペシャルミッション情報を入力する
- ゲームアップデート時は手動で更新する運用（許容済み）

### 次のアクション

- [ ] RotE TB 各フェーズの小隊キャラ一覧と必要レリックレベルを調べてJSONに入力する
- [ ] RotE TB スペシャルミッションの編成情報を調べてJSONに入力する
- [ ] 実データ入力後に再テストしてアドバイス精度を確認する

> **注:** 上記は手動JSONへの実データ入力タスク。CLIのチャット改修は完了済み。
> GP上位30キャラを渡す暫定対策により、実データ未入力でも一般論ハルシネーションはある程度改善されている。

### 補足: Comlink APIフィールド名の修正（2025）

- スター数のフィールド名が `rarity` ではなく `currentRarity` であることが判明
- `ComlinkUnit` の型定義と `formatUnit()` の両方を修正済み

### 補足: GPの追加（2025）

- `galacticPower` は `rosterUnit` には存在しない（undefined）ことが判明
- `profileStat` の `nameKey` から取得する方式に修正済み
  - 総GP: `STAT_GALACTIC_POWER_ACQUIRED_NAME`
  - キャラGP: `STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME`
  - 艦隊GP: `STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME`
- プロンプトに「総GP / キャラGP / 艦隊GP」の3値を追加済み
- ただしGPだけ渡しても手動JSONが空のため、アドバイスは依然として一般論のまま
- **根本解決は手動JSONへの実データ入力が必須**

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
│   │   ├── comlink/
│   │   │   ├── client.ts        # ComlinkへのHTTPリクエスト
│   │   │   ├── formatPlayer.ts  # プレイヤーデータ整形・getTopNUnits()
│   │   │   ├── types.ts         # 型定義
│   │   │   └── index.ts
│   │   ├── advisor/
│   │   │   ├── client.ts        # AI呼び出し（continueChat・会話履歴対応）
│   │   │   ├── prompt.ts        # システムプロンプト組み立て
│   │   │   ├── providers.ts     # AIプロバイダー管理（Google / Anthropic）
│   │   │   └── index.ts
│   │   └── data/
│   │       ├── rote-platoons.json          # RotE TB 小隊情報（手動管理・実データ未入力）
│   │       ├── rote-special-missions.json  # RotE TB スペシャルミッション（手動管理・実データ未入力）
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
│   │       ├── rote.ts          # RotE TB（小隊・通常・スペシャル・GP上げ）
│   │       ├── tw.ts            # TW（スケルトン）
│   │       └── gac.ts           # GAC（スケルトン）
│   │
│   ├── discord/                 # Phase 2: Discord bot ✅ 実装済み
│   │   ├── index.ts             # エントリーポイント（bun run discord）
│   │   ├── deploy-commands.ts   # スラッシュコマンド登録スクリプト
│   │   ├── Dockerfile           # Discord bot コンテナ定義
│   │   └── commands/
│   │       └── advice.ts        # /advice コマンド定義・ハンドラー
│   └── web/                     # Phase 3: Webアプリ（未実装）
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

- [ ] **Discord スレッドでの会話継続対応**（← 現在のフォーカス）
  - `/advice` 実行後にスレッドを自動作成
  - スレッド内でユーザーのメッセージに返答し続ける
  - 会話セッション（システムプロンプト + 履歴）をメモリ（Map）で管理
- [ ] RotE TB 手動JSONへの実データ入力（小隊・スペシャルミッション）
- [ ] 実データ入力後にアドバイス精度を再テスト

## Phase 2 Discord bot 実装メモ

### 実装済みの機能

- `/advice allycode:<9桁> [mode:<rote|tw|gac>] [purpose:<platoon|...>]` スラッシュコマンド
- `mode` 省略時: GP上位30キャラのデータ表示のみ
- `mode` 指定時: `core/advisor` を呼び出してAIアドバイスを返す
- 2000文字超の場合はメッセージ分割（`editReply` + `followUp`）
- Docker化済み（`docker compose up -d` で起動）

### COMLINK_URL の扱い

- ローカル実行（`bun run discord`）: デフォルト `http://localhost:5001`
- Docker コンテナ内: 環境変数 `COMLINK_URL=http://swgoh-comlink:3000` で上書き
- `docker-compose.yml` の `environment` セクションで設定済み

### .dockerignore について

- `.env` をコンテナに含めないために `.dockerignore` を作成
- Bun はカレントディレクトリの `.env` を自動読み込みするため、
  コンテナ内に `.env` が存在すると `docker-compose.yml` の環境変数を上書きしてしまう
- `packages/discord/` に誤って `.env` を置くと同様の問題が起きるので注意

### スレッド会話継続の設計方針（決定済み）

- `/advice` を叩いたら返答と同時に**スレッドを自動作成**
- スレッド内でユーザーがメッセージを送るたびにBotが返答し続ける
- 会話セッションはスレッドIDをキーにメモリ（`Map`）で管理
- Bot再起動でセッションは消える（Phase 2はこれで許容）
- チャンネルが荒れない・CLIに近い体験・Discord標準UX

---

## Phase 1 CLI チャット形式への改修設計（✅ 実装完了）

### 背景・問題意識

Phase 1の初期実装（`bun run cli 445833733 --tb rote`）は動作したが以下の問題があり、チャット形式に全面改修した：

1. **アドバイスが一般論** — 手動JSONが空のため、AIに渡す実データがなくハルシネーション
2. **1回で終わる** — アドバイスを1回出して終了するだけで、掘り下げができない
3. **UXが悪い** — allyCodeやモードをコマンドライン引数で渡す必要があり使いにくい

### 決定した改善方針

#### 1. 起動コマンドの変更

```
# 変更前
bun run cli 445833733 --tb rote

# 変更後
bun run cli   ← 引数なし。全部チャットの中で聞く
```

#### 2. 対話型チャットフロー

```
① アライコード確認
  [初回]    → 入力を求める → ~/.swgoh-advisor/config.json に保存
  [2回目以降] → 「前回のアライコード: XXXXXXXXX で続けますか？ [Y/n]: 」

② プレイヤーデータ取得・整形
  → GP上位30キャラ + レリック値 を抽出（← 暫定データとして活用）
  → 手動JSONデータ（RotE要件等）も合わせて読み込む

③ モード選択（選択式）
  → 1) RotE TB  2) TW  3) GAC  ...

④ 目的選択（選択式・モードによって変わる）
  → 1) 小隊配置  2) 通常戦闘  3) スペシャルミッション  4) GP上げ全般  ...

⑤ 自由追記（任意）
  → 「補足があれば入力してください（Enterでスキップ）: 」

⑥ 初回アドバイス表示

⑦ 掘り下げチャット（自由入力・/exit で終了）
```

#### 3. データ戦略（暫定解）

- **GP上位30キャラ + レリック値** を常にAIに渡す（手動JSONが空でも一般論を防ぐ）
- 手動JSONデータも合わせて渡す（空でもOK・埋まれば精度UP）
- → `formatPlayer.ts` に「GP上位N件抽出関数」を追加する

#### 4. 会話履歴の持ち方

- **Phase 1（軽量版）**: プレイヤーデータ＋目的をシステムプロンプトに全部詰めて、user/assistantのやり取りをそのまま積み上げる
- **Phase 2以降（重厚版）**: 「決定事項メモ管理」方式に移行予定

#### 5. アライコードの保存先

- `~/.swgoh-advisor/config.json`（ホームディレクトリ）
- CLI専用の関心事 → `packages/cli/config.ts` に閉じ込める（`core/` には含めない）
- Web・Discordではそれぞれのセッション/DBで管理する（設計上の責務分離）

### 追加・変更するファイル

```
packages/
├── core/
│   ├── comlink/
│   │   └── formatPlayer.ts     # GP上位N件抽出関数を追加
│   └── advisor/
│       ├── prompt.ts           # チャット用システムプロンプトに変更
│       └── client.ts           # 会話履歴を受け取れるように変更
│
└── cli/
    ├── index.ts                # チャットループに全面改修
    ├── chat.ts                 # 対話ループ本体（新規）
    ├── selector.ts             # 選択式UIのユーティリティ（新規）
    ├── config.ts               # ~/.swgoh-advisor/config.json の読み書き（新規）
    └── modes/                  # モード別の選択肢定義（新規）
        ├── rote.ts             # RotE TBの目的選択肢
        ├── tw.ts               # TW用（スケルトンのみ）
        └── gac.ts              # GAC用（スケルトンのみ）
```

### 実装済みタスク

- [x] `packages/cli/config.ts` を実装（アライコードの保存・読み込み）
- [x] `packages/cli/selector.ts` を実装（選択式UIのユーティリティ）
- [x] `packages/cli/modes/rote.ts` を実装（RotE TBの目的選択肢定義）
- [x] `packages/cli/modes/tw.ts` / `gac.ts` をスケルトンで追加
- [x] `packages/core/comlink/formatPlayer.ts` に `getTopNUnits()` を追加
- [x] `packages/core/advisor/prompt.ts` をチャット用システムプロンプトに変更
- [x] `packages/core/advisor/client.ts` を会話履歴対応に変更（`continueChat()`）
- [x] `packages/cli/chat.ts` を実装（対話ループ本体）
- [x] `packages/cli/index.ts` を全面改修（チャットループ起動・引数不要）
- [ ] 手動JSONへの実データ入力（← 残タスク・埋まれば精度UP）

## Phase 2 開発計画（✅ 基本実装完了）

### 実装済みステップ

#### Step 1: Discord bot セットアップ・コマンド認識確認 ✅

- `packages/discord/` の初期構成（package.json・tsconfig.json）
- `packages/discord/commands/advice.ts`: `/advice` コマンド定義（固定返答）
- `packages/discord/deploy-commands.ts`: スラッシュコマンド登録スクリプト
- `packages/discord/index.ts`: Bot エントリーポイント

#### Step 2: Comlinkデータ取得の確認 ✅

- `/advice` に `allycode` オプション追加
- Comlinkからプレイヤーデータ取得 → GP上位30キャラ整形してDiscordに返す
- `ComlinkUnit.rarity` → `currentRarity` のフィールド名バグを修正
- `getTopNUnits` を `core/comlink/index.ts` からエクスポート追加

#### Step 3: AIアドバイスまでの確認 ✅

- `/advice` に `mode` / `purpose` オプション追加
- `core/advisor` の `continueChat()` を Discord から呼び出す
- 2000文字超のメッセージ分割対応
- `COMLINK_URL` 環境変数対応

#### Dockerコンテナ化 ✅

- `packages/discord/Dockerfile` 作成
- `docker-compose.yml` に `discord-bot` サービス追加
- `.dockerignore` 作成（`.env` 除外・Bunの自動読み込み干渉を防ぐ）

### 次のステップ

#### Step 4: スレッドでの会話継続対応

- `/advice` 実行後にスレッドを自動作成
- スレッドIDをキーにセッション（システムプロンプト + 会話履歴）をメモリ管理
- スレッド内のメッセージイベントを購読してBotが返答し続ける

---

## Phase 1 開発計画（✅ 全ステップ完了）

### ステップ一覧

#### Step 1: monorepo 初期セットアップ (`feat/step1-monorepo-setup`) ✅

- ルートに `package.json`（Bun workspaces設定）と `tsconfig.json` を作成
- `packages/core/package.json` と `packages/cli/package.json` を作成
- 各パッケージの `tsconfig.json` を作成

#### Step 2: `core/comlink` — Comlinkクライアント実装 (`feat/step2-comlink-client`) ✅

- `packages/core/comlink/client.ts` : `/player` へのHTTPリクエスト関数
- `packages/core/comlink/types.ts` : レスポンスの型定義（最低限）
- 入力: `allyCode: string` → 出力: 生のプレイヤーJSON

#### Step 3: `core/comlink` — プレイヤーデータ整形 (`feat/step3-player-formatter`) ✅

- `packages/core/comlink/formatPlayer.ts` : 生JSONから必要フィールドだけ抽出
- 抽出対象（暫定）: キャラ名・レリックレベル・ギアレベル・スター数
- RotE TB関連キャラに絞ってフィルタ

#### Step 4: `core/data` — RotE TB 手動JSON設計・作成 (`feat/step4-rote-data`) ✅（スキーマのみ・実データ未入力）

- `packages/core/data/rote-platoons.json` : 小隊情報（キャラID + 必要レリック数）
- `packages/core/data/rote-special-missions.json` : スペシャルミッション情報
- ゲームアップデート時に手動更新する運用

#### Step 5: `core/advisor` — Claude API プロンプト生成・呼び出し (`feat/step5-advisor`) ✅

- `packages/core/advisor/prompt.ts` : RotE TB用プロンプトを組み立てる関数
- `packages/core/advisor/client.ts` : Claude APIを呼び出す関数
- `.env` に `ANTHROPIC_API_KEY` を設定する運用

#### Step 6: `packages/cli` — CLIエントリーポイント実装 (`feat/step6-cli`) ✅

- `packages/cli/index.ts` : `bun run cli` で起動する対話型チャットCLI
- Step 2〜5を組み合わせたパイプラインを完成（その後チャット形式に全面改修済み）

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
