/**
 * core/data パッケージの型定義
 * rote-platoons.json / rote-special-missions.json のスキーマに対応する型
 */

// -------------------------------------------------------
// 小隊（Platoon）型
// -------------------------------------------------------

export interface PlatoonUnit {
  /** ComlinkのユニットID（例: "DARTHVADER"） */
  id: string;
  /** 必要レリックレベル（0 = レリック不要） */
  requiredRelicLevel: number;
  /** メモ（キャラの表示名など） */
  note: string;
}

export interface Platoon {
  platoonId: string;
  platoonName: string;
  units: PlatoonUnit[];
}

export interface PlatoonZone {
  zoneId: string;
  zoneName: string;
  platoons: Platoon[];
}

export interface PlatoonPhase {
  phase: number;
  name: string;
  zones: PlatoonZone[];
}

export interface RotePlatoonsData {
  phases: PlatoonPhase[];
}

// -------------------------------------------------------
// スペシャルミッション / 属性限定戦闘ミッション 共通型
// -------------------------------------------------------

/**
 * ミッション種別
 * - "special"           : スペシャルミッション（特別報酬あり）
 * - "combat_restricted" : 属性限定戦闘ミッション（通常TP報酬のみ）
 */
export type MissionType = "special" | "combat_restricted";

export interface SpecialMissionUnit {
  /** ComlinkのユニットID（例: "DARTHVADER"） */
  id: string;
  /** 必要レリックレベル（0 = レリック不要） */
  requiredRelicLevel: number;
  /** リーダー指定かどうか */
  isLeader: boolean;
  /**
   * 任意の枠かどうか（true = 属性を満たす任意キャラでOK）
   * false または省略時 = id で指定した特定キャラが必須
   */
  isAny?: boolean;
  /** メモ（キャラの表示名・属性名など） */
  note: string;
}

export interface SpecialMissionSquad {
  squadId: string;
  squadName: string;
  /**
   * このスクワッド全体に課せられる属性タグ制限（任意）
   * 例: ["Mandalorian"] → マンダロリアンのキャラのみ参加可
   * 省略時 = タグ制限なし
   */
  requiredTags?: string[];
  units: SpecialMissionUnit[];
}

/**
 * SMクリアで獲得できる報酬アイテム
 */
export interface SpecialMissionReward {
  /** 報酬アイテム名（例: "ギルドイベントトークン Mk2", "Revaのかけら"） */
  item: string;
  /** 獲得数 */
  amount: number;
}

export interface SpecialMission {
  missionId: string;
  missionName: string;
  /**
   * ミッション種別（省略時は "special" として扱う）
   */
  missionType?: MissionType;
  description: string;
  /**
   * このSMをクリアすると獲得できる追加報酬
   * combat_restricted ミッションには通常設定しない
   * 省略時 = 追加報酬なし（通常TPのみ）
   */
  rewards?: SpecialMissionReward[];
  squads: SpecialMissionSquad[];
}

export interface SpecialMissionZone {
  zoneId: string;
  zoneName: string;
  missions: SpecialMission[];
}

export interface SpecialMissionPhase {
  phase: number;
  name: string;
  zones: SpecialMissionZone[];
}

export interface RoteSpecialMissionsData {
  phases: SpecialMissionPhase[];
}

// -------------------------------------------------------
// 集約型（アドバイス生成で使いやすい形）
// -------------------------------------------------------

/**
 * RotE TBで必要なユニットIDとレリックレベルの要件をフラットにまとめた型
 * Platoon / SpecialMission / CombatRestricted 全てから集約して使う
 */
export interface UnitRequirement {
  /** ComlinkのユニットID */
  id: string;
  /** 必要レリックレベル */
  requiredRelicLevel: number;
  /** この要件の出所 */
  source: "platoon" | "special_mission" | "combat_restricted";
  /** 出所の詳細（例: "Phase 1 > Dark Side > Platoon 1"） */
  sourceLabel: string;
  /** メモ（キャラの表示名・属性名など） */
  note: string;
  /**
   * 任意の枠かどうか（true = 属性を満たす任意キャラでOK）
   * true の場合、id はキャラIDではなく属性名などのラベルになる
   */
  isAny?: boolean;
  /**
   * このスクワッド全体の属性タグ制限
   * 例: ["Mandalorian"]
   */
  requiredTags?: string[];
}
