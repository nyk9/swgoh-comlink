/**
 * TW（テリトリーウォー）モード定義
 *
 * 現在はスケルトンのみ。Phase 2以降で詳細を実装する。
 * 新しい目的を追加する場合はここだけ変更すればよい。
 */

import type { SelectOption } from "../selector.ts";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

export type TwPurpose = "defense" | "offense" | "gp";

// -------------------------------------------------------
// モード定義
// -------------------------------------------------------

export const TW_MODE_LABEL = "TW（テリトリーウォー）";

/**
 * TW の目的選択肢
 */
export const TW_PURPOSE_OPTIONS: SelectOption<TwPurpose>[] = [
  {
    label: "防衛編成の強化",
    value: "defense",
  },
  {
    label: "攻撃編成の強化",
    value: "offense",
  },
  {
    label: "GP上げ全般（TW貢献も考慮）",
    value: "gp",
  },
];
