/**
 * RotE TB データ読み込みモジュール
 * 手動管理JSONを読み込み、アドバイス生成で使いやすい形に集約する
 */

import type {
  RotePlatoonsData,
  RoteSpecialMissionsData,
  UnitRequirement,
} from "./types.ts";

import platoonsRaw from "./rote-platoons.json" with { type: "json" };
import specialMissionsRaw from "./rote-restricted-missions.json" with { type: "json" };

// -------------------------------------------------------
// 小隊データの集約
// -------------------------------------------------------

/**
 * 小隊JSONからUnitRequirement配列を生成する
 */
function collectPlatoonRequirements(): UnitRequirement[] {
  const data = platoonsRaw as unknown as RotePlatoonsData;
  const requirements: UnitRequirement[] = [];

  for (const phase of data.phases) {
    for (const zone of phase.zones) {
      for (const platoon of zone.platoons) {
        for (const unit of platoon.units) {
          requirements.push({
            id: unit.id,
            requiredRelicLevel: unit.requiredRelicLevel,
            source: "platoon",
            sourceLabel: `${phase.name} > ${zone.zoneName} > ${platoon.platoonName}`,
            note: unit.note,
          });
        }
      }
    }
  }

  return requirements;
}

// -------------------------------------------------------
// スペシャルミッションデータの集約
// -------------------------------------------------------

/**
 * スペシャルミッション / 属性限定戦闘ミッションJSONからUnitRequirement配列を生成する
 *
 * missionType が "combat_restricted" のミッションは source: "combat_restricted" として扱う。
 * 省略時・"special" は source: "special_mission" として扱う。
 */
function collectSpecialMissionRequirements(): UnitRequirement[] {
  const data = specialMissionsRaw as unknown as RoteSpecialMissionsData;
  const requirements: UnitRequirement[] = [];

  for (const phase of data.phases) {
    for (const zone of phase.zones) {
      for (const mission of zone.missions) {
        const source =
          mission.missionType === "combat_restricted"
            ? "combat_restricted"
            : "special_mission";

        for (const squad of mission.squads) {
          for (const unit of squad.units) {
            requirements.push({
              id: unit.id,
              requiredRelicLevel: unit.requiredRelicLevel,
              source,
              sourceLabel: `${phase.name} > ${zone.zoneName} > ${mission.missionName} > ${squad.squadName}`,
              note: unit.note,
              ...(unit.isAny === true ? { isAny: true } : {}),
              ...(squad.requiredTags !== undefined ? { requiredTags: squad.requiredTags } : {}),
            });
          }
        }
      }
    }
  }

  return requirements;
}

// -------------------------------------------------------
// 公開API
// -------------------------------------------------------

/**
 * RotE TB の全ユニット要件（小隊 + スペシャルミッション）を返す
 */
export function getAllRoteRequirements(): UnitRequirement[] {
  return [
    ...collectPlatoonRequirements(),
    ...collectSpecialMissionRequirements(),
  ];
}

/**
 * RotE TB で登場する全ユニットIDの重複なしリストを返す
 */
export function getAllRoteUnitIds(): string[] {
  const requirements = getAllRoteRequirements();
  return [...new Set(requirements.map((r) => r.id))];
}

/**
 * 指定したユニットIDに関する要件一覧を返す
 */
export function getRequirementsForUnit(unitId: string): UnitRequirement[] {
  return getAllRoteRequirements().filter((r) => r.id === unitId);
}

/**
 * 各ユニットIDごとに「最も高い必要レリックレベル」を返すMapを生成する
 * 同じユニットが複数の小隊・ミッションに登場する場合、最大値を採用する
 */
export function getMaxRelicRequirementsMap(): Map<string, number> {
  const requirements = getAllRoteRequirements();
  const map = new Map<string, number>();

  for (const req of requirements) {
    const current = map.get(req.id) ?? 0;
    if (req.requiredRelicLevel > current) {
      map.set(req.id, req.requiredRelicLevel);
    }
  }

  return map;
}
