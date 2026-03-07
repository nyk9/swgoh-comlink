/**
 * core/comlink パッケージの公開インターフェース
 */

export { fetchPlayerData, ComlinkError } from "./client.ts";
export type { ComlinkClientConfig } from "./client.ts";

export { formatPlayer, filterUnitsByIds, filterUnitsByMinRelic, getTopNUnits, getUnitsAboveMinRelic } from "./formatPlayer.ts";

export { fetchRoteData, clearRoteDataCache } from "./fetchRoteData.ts";

export type {
  ComlinkPlayerResponse,
  ComlinkUnit,
  ComlinkRelic,
  ComlinkPlayerStat,
  FormattedPlayer,
  FormattedUnit,
  RelicTier,
  GearLevel,
  StarLevel,
  RoteGameData,
  RoteSpecialMissionData,
  RoteSMReward,
} from "./types.ts";
