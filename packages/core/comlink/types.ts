/**
 * Comlink API レスポンスの型定義
 * 必要最低限のフィールドのみ定義する（トークン節約のため）
 */

// -------------------------------------------------------
// /data エンドポイント: RotE TB 関連の生データ型
// -------------------------------------------------------

/**
 * minimumRelicTier の内部値 → 実際のレリックレベルへの変換
 * Comlinkの内部値は +2 オフセット（currentTier と同じ仕様）
 * 例: 7 -> R5, 9 -> R7, 10 -> R8, 11 -> R9
 */
export const COMLINK_RELIC_TIER_OFFSET = 2;

/** covertZoneDefinition の victoryReward アイテム */
export interface ComlinkVictoryRewardItem {
  id: string;
  type: number;
  minQuantity: number;
  maxQuantity: number;
}

/** covertZoneDefinition の zoneDefinition */
export interface ComlinkCovertZoneDefinition {
  campaignElementIdentifier: {
    campaignId: string;
    campaignMapId: string;
    campaignNodeId: string;
    campaignMissionId: string;
  };
  zoneDefinition: {
    zoneId: string;
    nameKey: string;
    linkedConflictId: string;
  };
  victoryReward: ComlinkVictoryRewardItem[];
  combatType: number;
}

/** conflictZoneDefinition の victoryPointRewards（星閾値） */
export interface ComlinkVictoryPointReward {
  galacticScoreRequirement: string;
  victoryPointReward: number;
  reward: {
    type: number;
    value: string;
    rewardId: string;
  };
}

/** conflictZoneDefinition（通常戦闘ゾーン） */
export interface ComlinkConflictZoneDefinition {
  zoneDefinition: {
    zoneId: string;
    nameKey: string;
  };
  victoryPointRewards: ComlinkVictoryPointReward[];
  combatType: number;
}

/** territoryBattleDefinition の1エントリ */
export interface ComlinkTerritoryBattleDefinition {
  id: string;
  nameKey: string;
  roundCount: number;
  covertZoneDefinition: ComlinkCovertZoneDefinition[];
  conflictZoneDefinition: ComlinkConflictZoneDefinition[];
}

/** /data requestSegment:2 のレスポンス（TBD部分のみ） */
export interface ComlinkDataSegment2Response {
  territoryBattleDefinition: ComlinkTerritoryBattleDefinition[];
}

/** entryCategoryAllowed（ミッション参加要件） */
export interface ComlinkEntryCategoryAllowed {
  categoryId: string[];
  mandatoryRosterUnit: Array<{ id: string; slot: number }>;
  minimumUnitRarity: number;
  minimumRelicTier: number;
  maximumAllowedUnitQuantity: number;
  minimumRequiredUnitQuantity: number;
}

/** campaignNodeMission の1エントリ */
export interface ComlinkCampaignNodeMission {
  id: string;
  entryCategoryAllowed: ComlinkEntryCategoryAllowed | null;
}

/** campaignNode の1エントリ */
export interface ComlinkCampaignNode {
  id: string;
  campaignNodeMission: ComlinkCampaignNodeMission[];
}

/** campaignMap の1エントリ */
export interface ComlinkCampaignMap {
  id: string;
  campaignNodeDifficultyGroup: Array<{
    campaignNode: ComlinkCampaignNode[];
  }>;
}

/** campaign コレクションの1エントリ */
export interface ComlinkCampaign {
  id: string;
  campaignMap: ComlinkCampaignMap[];
}

/** /data requestSegment:4 のレスポンス（campaign部分のみ） */
export interface ComlinkDataSegment4Response {
  campaign: ComlinkCampaign[];
}

// -------------------------------------------------------
// 整形後の RotE TB データ型
// -------------------------------------------------------

/**
 * SMクリア報酬（Comlinkから自動取得したもの）
 */
export interface RoteSMReward {
  /** Comlink アイテムID（例: "TERRITORY_BATTLE_CURRENCY_02", "unitshard_THIRDSISTER"） */
  itemId: string;
  /** 数量 */
  quantity: number;
}

/**
 * RotE TB スペシャルミッション1件分の情報
 * campaign + covertZoneDefinition を突合して生成する
 */
export interface RoteSpecialMissionData {
  /** ミッションID（例: "PHASE3_TERRITORY_01_SPECIALMISSION"） */
  missionId: string;
  /** フェーズ番号（1〜6） */
  phase: number;
  /** ゾーンID（例: "tb3_mixed_phase03_conflict01"） */
  linkedConflictId: string;
  /** 必須キャラのユニットIDリスト */
  mandatoryUnitIds: string[];
  /** 参加可能カテゴリIDリスト */
  categoryIds: string[];
  /** 最低レリックレベル（実際のR値: 5, 7, 8, 9...） */
  minimumRelicLevel: number;
  /** 編成最大人数 */
  maxUnitCount: number;
  /** SMクリア報酬（covertZoneDefinitionから取得。取得できない場合は空配列） */
  rewards: RoteSMReward[];
}

/**
 * 起動時にキャッシュするRotE TBのゲームデータ全体
 */
export interface RoteGameData {
  /** SM一覧（campaign の SPECIALMISSION + covertZoneDefinition から生成） */
  specialMissions: RoteSpecialMissionData[];
  /** 各ゾーンの星閾値（P1〜P6 全ゾーン） */
  zoneStarThresholds: Array<{
    zoneId: string;
    /** 星1/2/3 それぞれに必要なギルドスコア */
    thresholds: [number, number, number];
  }>;
}

// -------------------------------------------------------
// 基本型
// -------------------------------------------------------

/** ユニットのレリックレベル（0 = レリックなし、1〜10 = レリックレベル） */
export type RelicTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** ユニットのギアレベル（1〜13） */
export type GearLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/** スター数（1〜7） */
export type StarLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// -------------------------------------------------------
// Comlink /player レスポンス型
// -------------------------------------------------------

/**
 * レリック情報
 * currentTier: 実際のレリックレベルは (currentTier - 2) となる
 * 例: currentTier=5 -> レリック3、currentTier=2 -> レリック未解放
 */
export interface ComlinkRelic {
  currentTier: number;
}

/**
 * ユニットデータ（キャラ・シップ共通）
 * 注意: galacticPower は rosterUnit には含まれない（profileStat から取得する）
 */
export interface ComlinkUnit {
  /** ユニットの定義ID（例: "DARTHVADER"） */
  definitionId: string;
  /** 現在のレベル（1〜85） */
  currentLevel: number;
  /** ギアレベル（1〜13） */
  currentTier: number;
  /** スター数（1〜7） */
  currentRarity: number;
  /** レリック情報（ギア13のキャラのみ存在） */
  relic?: ComlinkRelic;
}

/**
 * プレイヤーの統計情報
 */
export interface ComlinkPlayerStat {
  nameKey: string;
  value: string;
  index: number;
}

/**
 * /player エンドポイントのレスポンス（必要フィールドのみ）
 */
export interface ComlinkPlayerResponse {
  /** プレイヤー名 */
  name: string;
  /** アライコード（数字9桁） */
  allyCode: number;
  /** プレイヤーレベル（1〜85） */
  level: number;
  /** ギルド名（ギルド未加入の場合は空文字） */
  guildName: string;
  /** 保有ユニット一覧（キャラ + シップ） */
  rosterUnit: ComlinkUnit[];
  /** プレイヤー統計一覧（ゲーム内STATSスクリーンの値） */
  profileStat: ComlinkPlayerStat[];
}

// -------------------------------------------------------
// 整形後の型（formatPlayer.ts が返す型）
// -------------------------------------------------------

/**
 * 整形済みのユニット情報
 * Comlink の生データから必要なフィールドだけ抽出したもの
 */
export interface FormattedUnit {
  /** ユニットID（例: "DARTHVADER"） */
  id: string;
  /** ギアレベル（1〜13） */
  gearLevel: number;
  /** スター数（1〜7） */
  stars: number;
  /** レリックレベル（0 = レリック未解放、1〜9 = レリックレベル） */
  relicLevel: number;
}

/**
 * 整形済みのプレイヤー情報
 */
export interface FormattedPlayer {
  /** プレイヤー名 */
  name: string;
  /** アライコード */
  allyCode: number;
  /** プレイヤーレベル */
  level: number;
  /** ギルド名 */
  guildName: string;
  /** 総GP（profileStat の STAT_GALACTIC_POWER_ACQUIRED_NAME から取得） */
  galacticPower: number;
  /** キャラクターGP（profileStat の STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME から取得） */
  characterGalacticPower: number;
  /** 艦隊GP（profileStat の STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME から取得） */
  shipGalacticPower: number;
  /** 整形済みユニット一覧（IDをキーにしたMap） */
  units: Map<string, FormattedUnit>;
}
