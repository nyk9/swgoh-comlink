/**
 * core/advisor パッケージの公開インターフェース
 */

export { generateRoteTBAdvice, AdvisorError } from "./client.ts";
export type { AdvisorConfig } from "./client.ts";

export { buildRoteTBPrompt, buildSystemPrompt } from "./prompt.ts";
export type { RoteTBPromptInput } from "./prompt.ts";

export {
  createModel,
  isValidProviderId,
  DEFAULT_PROVIDER,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_API_KEY_ENV_VARS,
} from "./providers.ts";
export type { ProviderId } from "./providers.ts";
