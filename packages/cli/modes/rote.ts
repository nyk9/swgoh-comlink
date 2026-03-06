/**
 * RotE TB モード定義
 *
 * RotE TB セッションで使う選択肢・ラベルを定義する。
 * 新しい目的を追加する場合はここだけ変更すればよい。
 */

import type { SelectOption } from "../selector.ts";
import type { RotePurpose } from "../../core/advisor/prompt.ts";

// -------------------------------------------------------
// モード定義
// -------------------------------------------------------

export const ROTE_MODE_LABEL = "RotE TB（Rise of the Empire テリトリーバトル）";

/**
 * RotE TB の目的選択肢
 */
export const ROTE_PURPOSE_OPTIONS: SelectOption<RotePurpose>[] = [
  {
    label: "小隊配置（Platoon）の最大化",
    value: "platoon",
  },
  {
    label: "通常戦闘ミッションへの貢献",
    value: "combat_mission",
  },
  {
    label: "スペシャルミッションのクリア",
    value: "special_mission",
  },
  {
    label: "GP上げ全般（RotE TBへの貢献も考慮）",
    value: "gp",
  },
];
