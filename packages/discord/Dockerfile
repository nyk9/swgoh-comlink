# Discord Bot Dockerfile
# マルチステージビルドは使わず、Bun のランタイムイメージで直接起動する

FROM oven/bun:1-alpine

WORKDIR /app

# モノレポのルート設定ファイルをコピー
COPY package.json bun.lockb tsconfig.json ./

# 各パッケージの package.json をコピー（依存関係の解決に必要）
COPY packages/core/package.json ./packages/core/
COPY packages/discord/package.json ./packages/discord/

# 依存関係のインストール
RUN bun install

# ソースコードをコピー
COPY packages/core/ ./packages/core/
COPY packages/discord/ ./packages/discord/

# 起動
CMD ["bun", "run", "packages/discord/index.ts"]
