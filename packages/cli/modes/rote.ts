/**
 * RotE TB モード定義
 *
 * RotE TB セッションで使う選択肢・ラベルを定義する。
 * 新しい目的を追加する場合は core/advisor/prompt.ts の ROTE_PURPOSE_CONFIG だけ編集すればよい。
 * ラベルは ROTE_PURPOSE_LABELS から自動的に参照されるため、ここでの重複定義は不要。
 */

import type { SelectOption } from "../selector.ts";
import { ROTE_PURPOSE_LABELS } from "../../core/advisor/prompt.ts";
import type { RotePurpose } from "../../core/advisor/prompt.ts";

// -------------------------------------------------------
// モード定義
// -------------------------------------------------------

export const ROTE_MODE_LABEL = "RotE TB（Rise of the Empire テリトリーバトル）";

/**
 * RotE TB の目的選択肢
 * ラベルは ROTE_PURPOSE_LABELS から参照するため、追加・変更は prompt.ts の ROTE_PURPOSE_CONFIG のみでよい
 */
export const ROTE_PURPOSE_OPTIONS: SelectOption<RotePurpose>[] = [
  { label: ROTE_PURPOSE_LABELS.platoon,        value: "platoon"        },
  { label: ROTE_PURPOSE_LABELS.combat_mission, value: "combat_mission" },
  { label: ROTE_PURPOSE_LABELS.special_mission, value: "special_mission" },
  { label: ROTE_PURPOSE_LABELS.guild_rewards,  value: "guild_rewards"  },
];
