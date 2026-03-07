/**
 * チャット対話ループ本体
 *
 * セッション開始から /exit までの一連の対話フローを管理する。
 * - モード・目的選択（選択式）
 * - 自由追記（任意）
 * - 初回アドバイス生成
 * - 掘り下げチャット（会話履歴を保持）
 */

import type { Interface as ReadlineInterface } from "readline";
import type { LanguageModel } from "ai";
import type { FormattedPlayer } from "../core/comlink/types.ts";
import type { ChatMessage } from "../core/advisor/client.ts";
import type { ModeSelection } from "../core/advisor/prompt.ts";
import { continueChat } from "../core/advisor/client.ts";
import { buildSystemPrompt, buildInitialUserMessage } from "../core/advisor/prompt.ts";
import { fetchRoteData } from "../core/comlink/index.ts";
import { getUnitsAboveMinRelic } from "../core/comlink/formatPlayer.ts";
import { select, askOptional, askLine } from "./selector.ts";
import type { SelectOption } from "./selector.ts";
import type { RotePurpose } from "../core/advisor/prompt.ts";
import { ROTE_PURPOSE_OPTIONS, ROTE_MODE_LABEL } from "./modes/rote.ts";
import { TW_PURPOSE_OPTIONS, TW_MODE_LABEL } from "./modes/tw.ts";
import { GAC_PURPOSE_OPTIONS, GAC_MODE_LABEL } from "./modes/gac.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

/** RotE TB の最低レリックライン。R5以上のキャラ全件をAIに渡す */
const MIN_RELIC_FOR_ADVICE = 5;
const EXIT_COMMANDS = ["/exit", "/quit", "/q"];

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

type GameMode = "rote" | "tw" | "gac";

export interface ChatSessionConfig {
  /** readline インスタンス */
  rl: ReadlineInterface;
  /** AI モデルインスタンス */
  model: LanguageModel;
  /** 整形済みプレイヤーデータ */
  player: FormattedPlayer;
  /** 最大出力トークン数 */
  maxOutputTokens?: number;
  /** ComlinkのURL設定（省略時: http://localhost:5001） */
  comlinkBaseUrl?: string;
}

// -------------------------------------------------------
// モード選択
// -------------------------------------------------------

const MODE_OPTIONS: SelectOption<GameMode>[] = [
  { label: ROTE_MODE_LABEL, value: "rote" },
  { label: TW_MODE_LABEL, value: "tw" },
  { label: GAC_MODE_LABEL, value: "gac" },
];

/**
 * モードと目的を選択してModeSelectionを返す
 */
async function selectModeAndPurpose(
  rl: ReadlineInterface,
): Promise<ModeSelection> {
  const mode = await select<GameMode>(
    rl,
    "🎯 何のアドバイスが欲しいですか？",
    MODE_OPTIONS,
  );

  if (mode === "rote") {
    const purpose = await select<RotePurpose>(
      rl,
      "📌 RotE TBで何を重視しますか？",
      ROTE_PURPOSE_OPTIONS,
    );
    return { mode: "rote", purpose };
  }

  if (mode === "tw") {
    await select(
      rl,
      "📌 TWで何を重視しますか？",
      TW_PURPOSE_OPTIONS,
    );
    // TW は目的をModeSelectionに含めない（スケルトン）
    return { mode: "tw" };
  }

  // gac
  await select(
    rl,
    "📌 GACで何を重視しますか？",
    GAC_PURPOSE_OPTIONS,
  );
  return { mode: "gac" };
}

// -------------------------------------------------------
// システムプロンプト入力の組み立て
// -------------------------------------------------------

/**
 * プレイヤーデータ・選択内容からシステムプロンプト入力を組み立てる
 */
function buildSystemPromptInput(
  player: FormattedPlayer,
  selection: ModeSelection,
  userNote: string | undefined,
  roteGameData?: Awaited<ReturnType<typeof fetchRoteData>>,
) {
  const topUnits = getUnitsAboveMinRelic(player, MIN_RELIC_FOR_ADVICE);

  return {
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
    userNote,
    ...(roteGameData !== undefined ? { roteGameData } : {}),
  };
}

// -------------------------------------------------------
// 表示ユーティリティ
// -------------------------------------------------------

function printDivider(): void {
  console.log("\n" + "─".repeat(50));
}

function printThinking(): void {
  process.stdout.write("\n🤔 考え中...");
}

function clearThinking(): void {
  // 改行して「考え中...」を次の出力で上書きされた見た目にする
  process.stdout.write("\r" + " ".repeat(20) + "\r");
}

function printAIResponse(text: string): void {
  console.log("\n" + text);
}

function printExitHint(): void {
  console.log('\n💡 続けて質問できます。終了するには "/exit" と入力してください。');
}

// -------------------------------------------------------
// チャットループ
// -------------------------------------------------------

/**
 * チャットセッションを開始・実行する
 *
 * 1. モード・目的選択
 * 2. 自由追記（任意）
 * 3. 初回アドバイス生成
 * 4. 掘り下げチャット（/exit で終了）
 */
export async function runChatSession(config: ChatSessionConfig): Promise<void> {
  const { rl, model, player, maxOutputTokens, comlinkBaseUrl } = config;

  // --- Step 1: モード・目的選択 ---
  const selection = await selectModeAndPurpose(rl);

  // --- Step 2: 自由追記 ---
  const userNote = await askOptional(
    rl,
    "\n💬 補足があれば入力してください",
  );

  // --- Step 3: RotE TBデータ取得（roteモードのみ）---
  let roteGameData: Awaited<ReturnType<typeof fetchRoteData>> | undefined;
  if (selection.mode === "rote") {
    process.stdout.write("\n📡 RotE TBデータを取得中...");
    try {
      roteGameData = await fetchRoteData(
        comlinkBaseUrl ? { baseUrl: comlinkBaseUrl } : {},
      );
      process.stdout.write("\r✅ RotE TBデータ取得完了          \n");
    } catch {
      process.stdout.write("\r⚠️  RotE TBデータの取得に失敗しました（プレイヤーデータのみでアドバイスします）\n");
    }
  }

  // --- Step 4: システムプロンプト組み立て ---
  const systemPromptInput = buildSystemPromptInput(player, selection, userNote, roteGameData);

  // 初回ユーザーメッセージ
  const initialMessage = buildInitialUserMessage(selection);

  // 会話履歴（user/assistant のやり取りを積み上げる）
  const history: ChatMessage[] = [
    { role: "user", content: initialMessage },
  ];

  const advisorConfig = {
    model,
    ...(maxOutputTokens !== undefined && { maxOutputTokens }),
  };

  // --- Step 5: 初回アドバイス生成 ---
  printDivider();
  console.log("📋 初回アドバイスを生成しています...");
  printThinking();

  let firstResponse: string;
  firstResponse = await continueChat(
    { systemPromptInput, history },
    advisorConfig,
  );

  clearThinking();
  printDivider();
  printAIResponse(firstResponse);

  // 会話履歴にアシスタントの返答を追加
  history.push({ role: "assistant", content: firstResponse });

  printExitHint();

  // --- Step 6: 掘り下げチャットループ ---
  while (true) {
    printDivider();
    const userInput = await askLine(rl, "\n> ");

    // 終了コマンド
    if (EXIT_COMMANDS.includes(userInput.toLowerCase())) {
      console.log("\n👋 セッションを終了します。\n");
      break;
    }

    // 空入力はスキップ
    if (userInput === "") {
      continue;
    }

    // 会話履歴にユーザー入力を追加
    history.push({ role: "user", content: userInput });

    printThinking();

    let response: string;
    response = await continueChat(
      { systemPromptInput, history },
      advisorConfig,
    );

    clearThinking();
    printAIResponse(response);

    // 会話履歴にアシスタントの返答を追加
    history.push({ role: "assistant", content: response });
  }
}
