/**
 * スラッシュコマンドをDiscordに登録するデプロイスクリプト
 *
 * 使い方: bun run deploy-commands
 * または: bun run packages/discord/deploy-commands.ts
 *
 * コマンドの追加・変更時に実行する（毎回起動不要）。
 * Guild コマンドとして登録するため、反映は即時。
 */

import { REST, Routes } from "discord.js";
import { data as adviceCommand } from "./commands/advice.ts";

// -------------------------------------------------------
// 環境変数チェック
// -------------------------------------------------------

const token = process.env["DISCORD_TOKEN"];
const applicationId = process.env["DISCORD_APPLICATION_ID"];
const guildId = process.env["DISCORD_GUILD_ID"];

if (!token) {
  console.error("❌ 環境変数 DISCORD_TOKEN が設定されていません。");
  process.exit(1);
}

if (!applicationId) {
  console.error("❌ 環境変数 DISCORD_APPLICATION_ID が設定されていません。");
  process.exit(1);
}

// -------------------------------------------------------
// 登録するコマンド一覧
// -------------------------------------------------------

const commands = [adviceCommand.toJSON()];

// -------------------------------------------------------
// デプロイ処理
// -------------------------------------------------------

const rest = new REST({ version: "10" }).setToken(token);

async function deployCommands(): Promise<void> {
  console.log(`\n🚀 ${commands.length} 件のスラッシュコマンドを登録します...\n`);

  try {
    let data: unknown;

    if (guildId) {
      // Guild コマンドとして登録（即時反映）
      console.log(`📌 Guild コマンドとして登録: Guild ID = ${guildId}`);
      data = await rest.put(
        Routes.applicationGuildCommands(applicationId, guildId),
        { body: commands },
      );
    } else {
      // Global コマンドとして登録（反映に最大1時間かかる）
      console.log("🌐 Global コマンドとして登録（反映に最大1時間かかります）");
      data = await rest.put(
        Routes.applicationCommands(applicationId),
        { body: commands },
      );
    }

    const count = Array.isArray(data) ? data.length : "?";
    console.log(`\n✅ ${count} 件のコマンドを正常に登録しました！`);

    if (!guildId) {
      console.log("\n💡 ヒント: DISCORD_GUILD_ID を設定すると即時反映になります。");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ コマンド登録に失敗しました: ${message}`);
    if (process.env["DEBUG"] === "1" && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

deployCommands();
