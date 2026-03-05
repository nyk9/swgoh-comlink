/**
 * プレイヤーデータ整形モジュール
 * Comlinkの生JSONから必要なフィールドだけ抽出する
 */

import type {
  ComlinkPlayerResponse,
  ComlinkUnit,
  FormattedPlayer,
  FormattedUnit,
} from "./types.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

/**
 * Comlinkのレリック currentTier とゲーム内レリックレベルのオフセット
 * currentTier=2 -> レリック未解放（レリックレベル0扱い）
 * currentTier=3 -> レリック1
 * currentTier=11 -> レリック9
 */
const RELIC_TIER_OFFSET = 2;

/**
 * ギア13未満のユニットはレリック情報を持たないが、
 * currentTier が2の場合もレリック未解放扱いとする
 */
const RELIC_TIER_UNLOCKED_THRESHOLD = 3;

/**
 * profileStat の nameKey 定数
 * GP は rosterUnit には存在せず、profileStat から取得する
 */
const STAT_KEY_TOTAL_GP = "STAT_GALACTIC_POWER_ACQUIRED_NAME";
const STAT_KEY_CHARACTER_GP = "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME";
const STAT_KEY_SHIP_GP = "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME";

// -------------------------------------------------------
// ユニット整形
// -------------------------------------------------------

/**
 * ComlinkのユニットデータをFormattedUnitに変換する
 *
 * レリックレベルの計算:
 * - relic が存在しない場合 -> 0
 * - relic.currentTier < RELIC_TIER_UNLOCKED_THRESHOLD の場合 -> 0
 * - それ以外 -> currentTier - RELIC_TIER_OFFSET
 *
 * @param unit - Comlinkのユニットデータ
 * @returns 整形済みユニット情報
 */
function formatUnit(unit: ComlinkUnit): FormattedUnit {
  const relicLevel =
    unit.relic != null &&
    unit.relic.currentTier >= RELIC_TIER_UNLOCKED_THRESHOLD
      ? unit.relic.currentTier - RELIC_TIER_OFFSET
      : 0;

  return {
    id: unit.definitionId,
    gearLevel: unit.currentTier,
    stars: unit.rarity,
    relicLevel,
  };
}

// -------------------------------------------------------
// profileStat ユーティリティ
// -------------------------------------------------------

/**
 * profileStat から指定した nameKey の値を数値で返す
 * 該当する nameKey が存在しない場合は 0 を返す
 *
 * @param profileStat - プレイヤー統計情報の配列
 * @param nameKey - 取得したい統計の nameKey
 * @returns 統計値（数値）
 */
function getProfileStat(
  profileStat: ComlinkPlayerResponse["profileStat"],
  nameKey: string,
): number {
  const stat = profileStat.find((s) => s.nameKey === nameKey);
  return stat != null ? parseInt(stat.value, 10) || 0 : 0;
}

// -------------------------------------------------------
// プレイヤー整形
// -------------------------------------------------------

/**
 * Comlinkのプレイヤーレスポンスを整形済みデータに変換する
 *
 * - 全ユニットをMapに格納する（キー: definitionId）
 * - definitionId には ":SEVEN_STAR" などのサフィックスが付く場合があるため、
 *   コロンより前の部分をIDとして使用する
 * - GP は profileStat から取得する（rosterUnit には存在しない）
 *
 * @param raw - Comlinkの生プレイヤーレスポンス
 * @returns 整形済みプレイヤー情報
 */
export function formatPlayer(raw: ComlinkPlayerResponse): FormattedPlayer {
  const units = new Map<string, FormattedUnit>();

  for (const unit of raw.rosterUnit) {
    const id = unit.definitionId.split(":")[0];

    if (id == null || id === "") {
      continue;
    }

    const formatted = formatUnit({ ...unit, definitionId: id });
    units.set(id, formatted);
  }

  const galacticPower = getProfileStat(raw.profileStat, STAT_KEY_TOTAL_GP);
  const characterGalacticPower = getProfileStat(raw.profileStat, STAT_KEY_CHARACTER_GP);
  const shipGalacticPower = getProfileStat(raw.profileStat, STAT_KEY_SHIP_GP);

  return {
    name: raw.name,
    allyCode: raw.allyCode,
    level: raw.level,
    guildName: raw.guildName,
    galacticPower,
    characterGalacticPower,
    shipGalacticPower,
    units,
  };
}

// -------------------------------------------------------
// フィルタリングユーティリティ
// -------------------------------------------------------

/**
 * 整形済みプレイヤーデータから、指定したユニットIDのリストに絞り込む
 * 持っていないユニットはundefinedではなくエントリが存在しない状態になる
 *
 * @param player - 整形済みプレイヤー情報
 * @param unitIds - 絞り込みたいユニットIDの配列
 * @returns 絞り込み後のユニットMap
 */
export function filterUnitsByIds(
  player: FormattedPlayer,
  unitIds: string[],
): Map<string, FormattedUnit> {
  const filtered = new Map<string, FormattedUnit>();

  for (const id of unitIds) {
    const unit = player.units.get(id);
    if (unit != null) {
      filtered.set(id, unit);
    }
  }

  return filtered;
}

/**
 * 整形済みプレイヤーデータから、指定したレリックレベル以上のユニットだけ絞り込む
 *
 * @param units - ユニットMap
 * @param minRelicLevel - 最低レリックレベル
 * @returns 絞り込み後のユニットMap
 */
export function filterUnitsByMinRelic(
  units: Map<string, FormattedUnit>,
  minRelicLevel: number,
): Map<string, FormattedUnit> {
  const filtered = new Map<string, FormattedUnit>();

  for (const [id, unit] of units) {
    if (unit.relicLevel >= minRelicLevel) {
      filtered.set(id, unit);
    }
  }

  return filtered;
}
