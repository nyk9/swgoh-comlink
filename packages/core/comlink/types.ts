/**
 * Comlink API レスポンスの型定義
 * 必要最低限のフィールドのみ定義する（トークン節約のため）
 */

// -------------------------------------------------------
// 基本型
// -------------------------------------------------------

/** ユニットのレリックレベル（0 = レリックなし、1〜9 = レリックレベル） */
export type RelicTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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
 * 例: currentTier=5 → レリック3、currentTier=2 → レリック未解放
 */
export interface ComlinkRelic {
  currentTier: number;
}

/**
 * ユニットデータ（キャラ・シップ共通）
 */
export interface ComlinkUnit {
  /** ユニットの定義ID（例: "DARTHVADER"） */
  definitionId: string;
  /** 現在のレベル（1〜85） */
  currentLevel: number;
  /** ギアレベル（1〜13） */
  currentTier: number;
  /** スター数（1〜7） */
  rarity: number;
  /** レリック情報（ギア13のキャラのみ存在） */
  relic?: ComlinkRelic;
  /** ユニットが戦力（GP）に換算される値 */
  galacticPower: string;
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
  /** プレイヤー統計一覧 */
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
  /** 整形済みユニット一覧（IDをキーにしたMap） */
  units: Map<string, FormattedUnit>;
}
