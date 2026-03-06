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
    stars: unit.currentRarity,
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

// -------------------------------------------------------
// ユニット抽出ユーティリティ
// -------------------------------------------------------

/**
 * 指定したレリックレベル以上のユニットを全件返す（レリック降順）
 *
 * RotE TB は P1: R5以上、P2: R6以上、... P5/P6: R9/R10 が最低ラインのため、
 * R5以上を全件渡すことでAIが全フェーズの状況を正確に把握できる。
 *
 * ソート優先度:
 * 1. relicLevel 降順
 * 2. gearLevel 降順
 * 3. stars 降順
 *
 * @param player       - 整形済みプレイヤー情報
 * @param minRelicLevel - 最低レリックレベル（デフォルト: 5）
 * @returns 条件を満たす全ユニット配列（レリック降順）
 */
export function getUnitsAboveMinRelic(
  player: FormattedPlayer,
  minRelicLevel = 5,
): FormattedUnit[] {
  const allUnits = Array.from(player.units.values());

  return allUnits
    .filter((u) => u.relicLevel >= minRelicLevel)
    .sort((a, b) => {
      if (b.relicLevel !== a.relicLevel) return b.relicLevel - a.relicLevel;
      if (b.gearLevel !== a.gearLevel) return b.gearLevel - a.gearLevel;
      return b.stars - a.stars;
    });
}

/**
 * レリック降順上位N件のユニットを返す
 *
 * @deprecated AIへのデータ渡しには getUnitsAboveMinRelic を使うこと。
 *             後方互換のために残しているが、新規呼び出しは避けること。
 *
 * @param player - 整形済みプレイヤー情報
 * @param topN   - 上位何件を返すか（デフォルト: 50）
 * @returns 上位N件のユニット配列（レリック降順）
 */
export function getTopNUnits(
  player: FormattedPlayer,
  topN = 50,
): FormattedUnit[] {
  const allUnits = Array.from(player.units.values());

  const sorted = allUnits.sort((a, b) => {
    if (b.relicLevel !== a.relicLevel) return b.relicLevel - a.relicLevel;
    if (b.gearLevel !== a.gearLevel) return b.gearLevel - a.gearLevel;
    return b.stars - a.stars;
  });

  return sorted.slice(0, topN);
}
