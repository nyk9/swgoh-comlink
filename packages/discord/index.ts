/**
 * SWGoH Advisor Discord Bot
 * エントリーポイント
 *
 * 使い方: bun run discord
 *
 * 必要な環境変数:
 *   DISCORD_TOKEN          - Discord Bot トークン
 *   DISCORD_APPLICATION_ID - Discord アプリケーション ID
 */

import {
  Client,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { execute as adviceExecute } from "./commands/advice.ts";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

interface Command {
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// -------------------------------------------------------
// 環境変数チェック
// -------------------------------------------------------

const token = process.env["DISCORD_TOKEN"];

if (!token) {
  console.error("❌ 環境変数 DISCORD_TOKEN が設定されていません。");
  process.exit(1);
}

// -------------------------------------------------------
// コマンドマップ
// -------------------------------------------------------

const commands = new Map<string, Command>([
  ["advice", { execute: adviceExecute }],
]);

// -------------------------------------------------------
// Discord クライアント初期化
// -------------------------------------------------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// -------------------------------------------------------
// イベントハンドラー
// -------------------------------------------------------

client.once(Events.ClientReady, (readyClient) => {
  console.log(`\n✅ Discord Bot が起動しました: ${readyClient.user.tag}`);
  console.log("─".repeat(50));
  console.log("スラッシュコマンド /advice を試してみてください。");
  console.log("終了するには Ctrl+C を押してください。\n");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.warn(`⚠️  未知のコマンド: ${interaction.commandName}`);
    await interaction.reply({
      content: "❌ 未知のコマンドです。",
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ コマンド実行エラー [${interaction.commandName}]: ${message}`);

    if (process.env["DEBUG"] === "1" && error instanceof Error) {
      console.error(error.stack);
    }

    // すでに返答済みかどうかで分岐
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `❌ エラーが発生しました: ${message}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ エラーが発生しました: ${message}`,
        ephemeral: true,
      });
    }
  }
});

// -------------------------------------------------------
// Bot 起動
// -------------------------------------------------------

console.log("\n⏳ Discord Bot を起動中...");
client.login(token);
