/**
 * AI アドバイスクライアント
 * Vercel AI SDK の LanguageModel 型を受け取るプロバイダー非依存の設計。
 * どのプロバイダー（Google / Anthropic 等）を使うかはこのファイルは関知しない。
 * プロバイダーの選択・モデルインスタンス生成は providers.ts が担う。
 */

import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { buildRoteTBPrompt, buildSystemPrompt } from "./prompt.ts";
import type { RoteTBPromptInput } from "./prompt.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

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
 * RotE TB 育成アドバイスを生成する
 *
 * プロバイダー・モデルの選択は呼び出し元が行い、
 * このクライ数はプロンプト組み立てと generateText 呼び出しのみを担う。
 *
 * @param input  - プロンプト生成に必要なデータ
 * @param config - LanguageModel インスタンスと生成オプション
 * @returns 生成されたアドバイス文字列
 * @throws {AdvisorError} API 呼び出し失敗時
 */
export async function generateRoteTBAdvice(
  input: RoteTBPromptInput,
  config: AdvisorConfig,
): Promise<string> {
  const { model, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS } = config;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildRoteTBPrompt(input);

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
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
