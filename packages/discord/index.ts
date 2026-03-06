/**
 * SWGoH Advisor Discord Bot
 * エントリーポイント
 *
 * 使い方: bun run discord
 *
 * 必要な環境変数:
 *   DISCORD_TOKEN          - Discord Bot トークン
 *   DISCORD_APPLICATION_ID - Discord アプリケーション ID
 *
 * 必要な Privileged Gateway Intents（Discord Developer Portal で要有効化）:
 *   - MESSAGE CONTENT INTENT
 */

import {
  Client,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import { execute as adviceExecute } from "./commands/advice.ts";
import {
  getSession,
  appendToHistory,
  cleanupExpiredSessions,
  getSessionCount,
} from "./session.ts";
import { continueChat } from "../core/advisor/client.ts";
import { createModel, DEFAULT_PROVIDER } from "../core/advisor/providers.ts";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

interface Command {
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

/** スレッド内での返答の最大文字数（Discord 制限は 2000） */
const MAX_MESSAGE_LENGTH = 1900;

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
  intents: [
    GatewayIntentBits.Guilds,
    // スレッド内のメッセージを受信するために必要
    GatewayIntentBits.GuildMessages,
    // メッセージの本文 (content) を読むために必要（Privileged Intent）
    GatewayIntentBits.MessageContent,
  ],
});

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

/**
 * 長いテキストを Discord の文字数制限に合わせて分割する
 */
function splitMessage(text: string, maxLength = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    const slice = remaining.slice(0, maxLength);
    const lastNewline = slice.lastIndexOf("\n");
    const cutAt = lastNewline > 0 ? lastNewline : maxLength;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }

  return chunks;
}

/**
 * スレッド内のユーザーメッセージに対してAIで返答する
 */
async function handleThreadMessage(message: Message): Promise<void> {
  // Bot のメッセージは無視
  if (message.author.bot) return;

  // スレッド内のメッセージのみ処理
  if (!message.channel.isThread()) return;

  const threadId = message.channel.id;

  // 有効期限切れセッションをクリーンアップ（定期実行の代わり）
  cleanupExpiredSessions();

  // このスレッドに対応するセッションを取得
  const session = getSession(threadId);
  if (session === undefined) {
    // セッションなし（期限切れ or /advice 未実行のスレッド）は無視
    return;
  }

  const userContent = message.content.trim();
  if (userContent === "") return;

  console.log(
    `💬 スレッド [${threadId}] メッセージ受信: "${userContent.slice(0, 50)}${userContent.length > 50 ? "…" : ""}"`,
  );

  // タイピングインジケーターを表示
  await message.channel.sendTyping();

  try {
    // 会話履歴にユーザーメッセージを追記
    appendToHistory(threadId, { role: "user", content: userContent });

    // AIモデル準備
    const model = createModel(DEFAULT_PROVIDER);

    // セッションから最新の履歴を再取得（appendToHistory で更新済み）
    const updatedSession = getSession(threadId);
    if (updatedSession === undefined) {
      await message.reply("❌ セッションの取得に失敗しました。");
      return;
    }

    // AIに返答を生成させる
    const responseText = await continueChat(
      {
        systemPromptInput: updatedSession.systemPromptInput,
        history: updatedSession.history,
      },
      { model },
    );

    // アシスタントの返答を履歴に追記
    appendToHistory(threadId, { role: "assistant", content: responseText });

    // 返答を送信（長い場合は分割）
    const chunks = splitMessage(responseText);
    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }

    console.log(
      `✅ スレッド [${threadId}] 返答完了 (アクティブセッション数: ${getSessionCount()})`,
    );
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ スレッド [${threadId}] AI返答エラー: ${errMessage}`);

    if (process.env["DEBUG"] === "1" && error instanceof Error) {
      console.error(error.stack);
    }

    await message.reply(
      `❌ AIの返答生成に失敗しました。しばらく待ってから再度お試しください。\n詳細: ${errMessage}`,
    );

    // エラー時はユーザーメッセージを履歴から取り除いて整合性を保つ
    const sessionAfterError = getSession(threadId);
    if (sessionAfterError !== undefined) {
      const history = sessionAfterError.history;
      // 最後に追加したユーザーメッセージを削除（エラーだったため）
      if (history.length > 0 && history[history.length - 1]?.role === "user") {
        history.pop();
      }
    }
  }
}

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

// スレッド内のメッセージを受信して会話を継続する
client.on(Events.MessageCreate, async (message) => {
  try {
    await handleThreadMessage(message);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ MessageCreate ハンドラーエラー: ${errMessage}`);
  }
});

// -------------------------------------------------------
// Bot 起動
// -------------------------------------------------------

console.log("\n⏳ Discord Bot を起動中...");
client.login(token);
