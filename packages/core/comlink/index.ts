/**
 * core/comlink パッケージの公開インターフェース
 */

export { fetchPlayerData, ComlinkError } from "./client.ts";
export type { ComlinkClientConfig } from "./client.ts";

export { formatPlayer, filterUnitsByIds, filterUnitsByMinRelic, getTopNUnits } from "./formatPlayer.ts";

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
} from "./types.ts";
