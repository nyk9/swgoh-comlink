/**
 * core/data パッケージの公開インターフェース
 */

export {
  getAllRoteRequirements,
  getAllRoteUnitIds,
  getRequirementsForUnit,
  getMaxRelicRequirementsMap,
} from "./roteData.ts";

export type {
  RotePlatoonsData,
  RoteSpecialMissionsData,
  PlatoonPhase,
  PlatoonZone,
  Platoon,
  PlatoonUnit,
  SpecialMissionPhase,
  SpecialMissionZone,
  SpecialMission,
  SpecialMissionSquad,
  SpecialMissionUnit,
  UnitRequirement,
} from "./types.ts";
