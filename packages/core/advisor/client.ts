/**
 * AI アドバイスクライアント
 * Vercel AI SDK の LanguageModel 型を受け取るプロバイダー非依存の設計。
 * どのプロバイダー（Google / Anthropic 等）を使うかはこのファイルは関知しない。
 * プロバイダーの選択・モデルインスタンス生成は providers.ts が担う。
 *
 * チャット形式対応:
 * - generateRoteTBAdvice: 初回アドバイス生成（1ショット）
 * - continueChat: 会話履歴を受け取って続きを生成
 */

import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { buildSystemPrompt } from "./prompt.ts";
import type { ChatSystemPromptInput } from "./prompt.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

// -------------------------------------------------------
// 会話履歴の型
// -------------------------------------------------------

/**
 * 会話の1ターン（user または assistant のメッセージ）
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

export interface AdvisorConfig {
  /**
   * AI SDK の LanguageModel インスタンス（必須）
   * providers.ts の createModel() で生成して渡す。
   */
  model: LanguageModel;
  /** 最大出力トークン数（デフォルト: 2048） */
  maxOutputTokens?: number;
}

/**
 * チャットセッションの入力
 * システムプロンプト + 会話履歴全体を受け取る
 */
export interface ChatInput {
  /** システムプロンプト生成に必要なデータ */
  systemPromptInput: ChatSystemPromptInput;
  /** これまでの会話履歴（user/assistant のやり取り） */
  history: ChatMessage[];
}

// -------------------------------------------------------
// エラー型
// -------------------------------------------------------

export class AdvisorError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AdvisorError";
  }
}

// -------------------------------------------------------
// クライアント関数
// -------------------------------------------------------

/**
 * AI API を呼び出す共通内部関数
 *
 * @param model          - LanguageModel インスタンス
 * @param system         - システムプロンプト文字列
 * @param messages       - 会話履歴（CoreMessage 形式）
 * @param maxOutputTokens - 最大出力トークン数
 * @returns 生成されたテキスト
 * @throws {AdvisorError} API 呼び出し失敗時
 */
async function callAI(
  model: LanguageModel,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxOutputTokens: number,
): Promise<string> {
  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model,
      system,
      messages,
      maxOutputTokens,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new AdvisorError(
      `AI API の呼び出しに失敗しました。\n` +
        `APIキーが正しく設定されているか確認してください。\n` +
        `詳細: ${message}`,
      error,
    );
  }
  return result.text;
}

/**
 * チャットセッションでAIにメッセージを送り、返答を得る
 *
 * 会話履歴（history）をそのまま渡す軽量版。
 * システムプロンプトはセッション開始時に1回組み立てられ、
 * 以降の呼び出しでも同じものを使い回す。
 *
 * @param input  - システムプロンプト入力データ + 会話履歴
 * @param config - LanguageModel インスタンスと生成オプション
 * @returns 生成されたアドバイス文字列
 * @throws {AdvisorError} API 呼び出し失敗時
 */
export async function continueChat(
  input: ChatInput,
  config: AdvisorConfig,
): Promise<string> {
  const { model, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS } = config;
  const system = buildSystemPrompt(input.systemPromptInput);
  return callAI(model, system, input.history, maxOutputTokens);
}
