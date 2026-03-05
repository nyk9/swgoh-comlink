/**
 * AI プロバイダー管理モジュール
 *
 * 責務:
 * - 対応プロバイダーの定義（ProviderId）
 * - プロバイダー別のデフォルトモデルIDの管理
 * - LanguageModel インスタンスの生成（createModel）
 *
 * 新しいプロバイダーを追加する場合は、このファイルだけ変更すればよい。
 * client.ts / CLI はプロバイダーの詳細を知らなくてよい設計。
 */

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// -------------------------------------------------------
// プロバイダーID
// -------------------------------------------------------

/**
 * 対応しているAIプロバイダーの識別子
 *
 * 追加手順:
 * 1. ここに新しい識別子を追加する
 * 2. PROVIDER_DEFAULT_MODELS に対応するデフォルトモデルIDを追加する
 * 3. createModel の switch に対応するケースを追加する
 */
export type ProviderId = "google" | "anthropic";

/** デフォルトで使用するプロバイダー（無料枠があるGoogleをデフォルトに設定） */
export const DEFAULT_PROVIDER: ProviderId = "google";

// -------------------------------------------------------
// プロバイダー別デフォルトモデルID
// -------------------------------------------------------

/**
 * プロバイダーごとのデフォルトモデルID
 *
 * モデルIDはAI SDKが文字列として受け取るため、
 * 実際に使用できるモデルIDはプロバイダーのドキュメントを参照すること。
 *
 * Google: https://ai.google.dev/gemini-api/docs/models
 * Anthropic: https://docs.anthropic.com/en/docs/about-claude/models
 *
 * NOTE: ユーザーが希望する "Gemini flash-lite" 系モデルとして
 * 現時点では "gemini-2.0-flash-lite" が無料枠で利用可能。
 * Google AIのモデルラインナップは頻繁に更新されるため、
 * 最新の無料モデルは上記ドキュメントで確認すること。
 */
export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  google: "gemini-3.1-flash-lite-preview",
  anthropic: "claude-sonnet-4-20250514",
};

// -------------------------------------------------------
// プロバイダー表示名（ログ・エラーメッセージ用）
// -------------------------------------------------------

export const PROVIDER_DISPLAY_NAMES: Record<ProviderId, string> = {
  google: "Google Gemini",
  anthropic: "Anthropic Claude",
};

// -------------------------------------------------------
// 環境変数名（APIキー確認メッセージ用）
// -------------------------------------------------------

export const PROVIDER_API_KEY_ENV_VARS: Record<ProviderId, string> = {
  google: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
};

// -------------------------------------------------------
// バリデーション
// -------------------------------------------------------

const VALID_PROVIDER_IDS: ProviderId[] = ["google", "anthropic"];

/**
 * 文字列が有効なProviderIdかどうかを確認する型ガード
 */
export function isValidProviderId(value: string): value is ProviderId {
  return (VALID_PROVIDER_IDS as string[]).includes(value);
}

// -------------------------------------------------------
// モデルインスタンス生成
// -------------------------------------------------------

/**
 * プロバイダーIDとモデルIDから LanguageModel インスタンスを生成する
 *
 * APIキーは各プロバイダーの規約に従い環境変数から自動で読み込まれる:
 * - Google:    GOOGLE_GENERATIVE_AI_API_KEY
 * - Anthropic: ANTHROPIC_API_KEY
 *
 * @param providerId - 使用するプロバイダーの識別子
 * @param modelId    - 使用するモデルID（省略時はプロバイダーのデフォルトを使用）
 * @returns AI SDK の LanguageModel インスタンス
 */
export function createModel(
  providerId: ProviderId,
  modelId?: string,
): LanguageModel {
  const resolvedModelId = modelId ?? PROVIDER_DEFAULT_MODELS[providerId];

  switch (providerId) {
    case "google":
      return google(resolvedModelId);

    case "anthropic":
      return anthropic(resolvedModelId);
  }
}
