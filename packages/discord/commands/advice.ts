/**
 * /advice スラッシュコマンド定義
 *
 * Step 1: 固定の返答を返す（疎通確認用）✅
 * Step 2: allycode オプションを追加してComlinkデータを取得・返す ✅
 * Step 3: mode・purpose オプションを追加してAIアドバイスを返す ✅
 * Step 4: スレッドを自動作成して会話継続できるようにする ✅
 *
 * デバッグ機能:
 * - show_prompt オプション: AI に渡したシステムプロンプトを ephemeral で出力する
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { fetchPlayerData, ComlinkError } from "../../core/comlink/client.ts";
import { formatPlayer, getUnitsAboveMinRelic } from "../../core/comlink/formatPlayer.ts";
import { continueChat } from "../../core/advisor/client.ts";
import { buildInitialUserMessage, buildSystemPrompt } from "../../core/advisor/prompt.ts";
import { createModel, DEFAULT_PROVIDER } from "../../core/advisor/providers.ts";
import { getAllRoteRequirements, getMaxRelicRequirementsMap } from "../../core/data/roteData.ts";
import type { ModeSelection, RotePurpose, ChatSystemPromptInput } from "../../core/advisor/prompt.ts";
import { ROTE_PURPOSE_LABELS } from "../../core/advisor/prompt.ts";
import { createSession } from "../session.ts";

// -------------------------------------------------------
// コマンド定義
// -------------------------------------------------------

export const data = new SlashCommandBuilder()
  .setName("advice")
  .setDescription("SWGoHの育成アドバイスを取得します")
  .addStringOption((option) =>
    option
      .setName("allycode")
      .setDescription("アライコード（9桁の数字）")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("mode")
      .setDescription("ゲームモード（省略時: データ取得のみ）")
      .setRequired(false)
      .addChoices(
        { name: "RotE TB", value: "rote" },
        { name: "テリトリーウォー (TW)", value: "tw" },
        { name: "グランドアリーナ (GAC)", value: "gac" },
      )
  )
  .addStringOption((option) =>
    option
      .setName("purpose")
      .setDescription("目的（mode=rote のときのみ有効）")
      .setRequired(false)
      .addChoices(
        { name: ROTE_PURPOSE_LABELS.platoon,         value: "platoon"        },
        { name: ROTE_PURPOSE_LABELS.combat_mission,  value: "combat_mission" },
        { name: ROTE_PURPOSE_LABELS.special_mission, value: "special_mission" },
        { name: ROTE_PURPOSE_LABELS.guild_rewards,   value: "guild_rewards"  },
      )
  )
  .addBooleanOption((option) =>
    option
      .setName("show_prompt")
      .setDescription("[DEBUG] AIに渡したシステムプロンプトを自分だけに表示する")
      .setRequired(false)
  );

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

/**
 * allycode のバリデーション
 * 数字9桁のみ許可（ハイフンなし）
 */
function validateAllyCode(allycode: string): boolean {
  return /^\d{9}$/.test(allycode.replace(/-/g, ""));
}

/**
 * allycode を正規化（ハイフン除去）
 */
function normalizeAllyCode(allycode: string): string {
  return allycode.replace(/-/g, "");
}

/**
 * GP上位ユニット一覧をDiscordメッセージ用テキストに変換する
 * Discordの2000文字制限を考慮してコンパクトに整形する
 */
function formatTopUnitsForDiscord(
  units: ReturnType<typeof getUnitsAboveMinRelic>
): string {
  if (units.length === 0) {
    return "  （データなし）";
  }

  return units
    .map((u, i) => {
      const status =
        u.gearLevel < 13
          ? `G${u.gearLevel} / ${u.stars}★`
          : `R${u.relicLevel} / ${u.stars}★`;
      return `  ${String(i + 1).padStart(2, " ")}. ${u.id.padEnd(30, " ")} ${status}`;
    })
    .join("\n");
}

/**
 * mode / purpose 文字列から ModeSelection 型に変換する
 */
function buildModeSelection(
  mode: string,
  purpose: string | null,
): ModeSelection | null {
  if (mode === "rote") {
    const validPurposes: RotePurpose[] = [
      "platoon",
      "combat_mission",
      "special_mission",
      "guild_rewards",
    ];
    const resolvedPurpose: RotePurpose =
      purpose != null && (validPurposes as string[]).includes(purpose)
        ? (purpose as RotePurpose)
        : "platoon"; // purpose 省略時は platoon をデフォルトに
    return { mode: "rote", purpose: resolvedPurpose };
  }
  if (mode === "tw") return { mode: "tw" };
  if (mode === "gac") return { mode: "gac" };
  return null;
}

/**
 * 長いテキストを Discord の文字数制限に合わせて分割する
 * 各チャンクは maxLength 以内に収める
 */
function splitMessage(text: string, maxLength = 1900): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    // maxLength 以内で最後の改行を探してそこで分割する
    const slice = remaining.slice(0, maxLength);
    const lastNewline = slice.lastIndexOf("\n");
    const cutAt = lastNewline > 0 ? lastNewline : maxLength;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }

  return chunks;
}

// -------------------------------------------------------
// ハンドラー
// -------------------------------------------------------

/**
 * /advice コマンドのハンドラー（Step 4: スレッドでの会話継続対応）
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const rawAllyCode = interaction.options.getString("allycode", true);
  const allyCode = normalizeAllyCode(rawAllyCode);
  const modeRaw = interaction.options.getString("mode");
  const purposeRaw = interaction.options.getString("purpose");
  const showPrompt = interaction.options.getBoolean("show_prompt") ?? false;

  // バリデーション
  if (!validateAllyCode(allyCode)) {
    await interaction.reply({
      content: "❌ アライコードは9桁の数字で入力してください。\n例: `445833733`",
      ephemeral: true,
    });
    return;
  }

  // 処理に時間がかかるためdeferする（3秒以内に返答しないとタイムアウト）
  await interaction.deferReply();

  try {
    // Comlinkからデータ取得（COMLINK_URL 環境変数があればそちらを使う）
    const comlinkUrl = process.env["COMLINK_URL"];
    const rawPlayer = await fetchPlayerData(
      allyCode,
      comlinkUrl ? { baseUrl: comlinkUrl } : {},
    );

    // データ整形
    const player = formatPlayer(rawPlayer);
    const topUnits = getUnitsAboveMinRelic(player, 5);

    // mode が指定されていない場合はデータ表示のみ
    if (modeRaw === null) {
      const topUnitsText = formatTopUnitsForDiscord(topUnits);
      const message = [
        `## 📊 プレイヤーデータ取得成功`,
        ``,
        `**プレイヤー名**: ${player.name}`,
        `**アライコード**: ${player.allyCode}`,
        `**レベル**: ${player.level}`,
        `**ギルド**: ${player.guildName || "（未加入）"}`,
        `**総GP**: ${player.galacticPower.toLocaleString("ja-JP")}`,
        `**キャラGP**: ${player.characterGalacticPower.toLocaleString("ja-JP")}`,
        `**艦隊GP**: ${player.shipGalacticPower.toLocaleString("ja-JP")}`,
        ``,
        `## 🏆 GP上位 ${topUnits.length} キャラクター`,
        `\`\`\``,
        topUnitsText,
        `\`\`\``,
        ``,
        `💡 AIアドバイスを受けるには \`mode\` オプションを指定してください。`,
        `例: \`/advice allycode:${allyCode} mode:rote purpose:platoon\``,
      ].join("\n");

      const trimmed =
        message.length > 1900 ? message.slice(0, 1900) + "\n…（省略）" : message;
      await interaction.editReply(trimmed);
      return;
    }

    // ModeSelection を組み立てる
    const selection = buildModeSelection(modeRaw, purposeRaw);
    if (selection === null) {
      await interaction.editReply("❌ 不正な mode が指定されました。");
      return;
    }

    // RotE TB 要件データの読み込み
    const roteRequirements =
      selection.mode === "rote" ? getAllRoteRequirements() : undefined;
    const maxRelicRequirementsMap =
      selection.mode === "rote" ? getMaxRelicRequirementsMap() : undefined;

    // システムプロンプト入力データを組み立てる（セッション登録にも使い回す）
    // exactOptionalPropertyTypes 対応: undefined になり得るオプショナルフィールドは
    // 値がある場合だけスプレッドで追加する
    const systemPromptInput: ChatSystemPromptInput = {
      playerName: player.name,
      allyCode: player.allyCode,
      level: player.level,
      guildName: player.guildName,
      galacticPower: player.galacticPower,
      characterGalacticPower: player.characterGalacticPower,
      shipGalacticPower: player.shipGalacticPower,
      topUnits,
      allUnitsMap: player.units,
      selection,
      ...(roteRequirements !== undefined ? { roteRequirements } : {}),
      ...(maxRelicRequirementsMap !== undefined ? { maxRelicRequirementsMap } : {}),
    };

    // AIモデル準備
    const model = createModel(DEFAULT_PROVIDER);

    // 初回ユーザーメッセージ
    const initialUserMessage = buildInitialUserMessage(selection);

    // AIアドバイス取得
    const adviceText = await continueChat(
      {
        systemPromptInput,
        history: [{ role: "user", content: initialUserMessage }],
      },
      { model },
    );

    // 返答メッセージ組み立て
    const header = [
      `## 🤖 SWGoH育成アドバイス`,
      `**プレイヤー**: ${player.name}　**総GP**: ${player.galacticPower.toLocaleString("ja-JP")}`,
      ``,
    ].join("\n");

    const fullMessage = header + adviceText;

    // 2000文字超の場合はメッセージを分割して送信
    const chunks = splitMessage(fullMessage);
    const firstChunk = chunks[0];
    if (firstChunk === undefined) {
      await interaction.editReply("❌ アドバイスの生成に失敗しました。");
      return;
    }

    await interaction.editReply(firstChunk);

    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk !== undefined) {
        await interaction.followUp(chunk);
      }
    }

    // -------------------------------------------------------
    // スレッド作成 & セッション登録
    // -------------------------------------------------------

    // スレッドが作れるのはギルドチャンネル内のメッセージのみ
    // DM やスレッド内での実行は対象外
    const reply = await interaction.fetchReply();

    if (!reply.channel || !("threads" in reply.channel)) {
      // スレッド非対応チャンネル（DM等）ではセッション登録のみスキップ
      return;
    }

    const thread = await reply.startThread({
      name: `💬 ${player.name} の育成相談`,
      // 自動アーカイブまでの時間（分）。セッション TTL の 1時間に合わせる
      autoArchiveDuration: 60,
    });

    // セッション登録
    // history には初回の user → assistant のやり取りを含める
    createSession(thread.id, systemPromptInput, [
      { role: "user", content: initialUserMessage },
      { role: "assistant", content: adviceText },
    ]);

    // [DEBUG] システムプロンプトをスレッド内に出力
    if (showPrompt) {
      const systemPrompt = buildSystemPrompt(systemPromptInput);
      // コードブロックは使わずプレーンテキストで分割する
      // （コードブロック内で分割するとDiscord側で閉じタグが欠けて表示が崩れるため）
      await thread.send(`## 🔍 [DEBUG] システムプロンプト`);
      const promptChunks = splitMessage(systemPrompt, 1900);
      for (const chunk of promptChunks) {
        await thread.send(chunk);
      }
    }

    await thread.send(
      [
        `💬 **このスレッドで続きの質問ができます！**`,
        `アドバイスについて掘り下げたいことがあれば、気軽にここへどうぞ。`,
        `（セッションは **1時間** 有効です）`,
      ].join("\n"),
    );
  } catch (error) {
    if (error instanceof ComlinkError) {
      await interaction.editReply(
        `❌ Comlinkからのデータ取得に失敗しました。\n` +
          `Dockerが起動しているか確認してください。\n` +
          `詳細: ${error.message}`,
      );
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply(`❌ エラーが発生しました: ${message}`);
  }
}
