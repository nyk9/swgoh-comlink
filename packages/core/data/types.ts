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
// スペシャルミッション型
// -------------------------------------------------------

export interface SpecialMissionUnit {
  /** ComlinkのユニットID（例: "DARTHVADER"） */
  id: string;
  /** 必要レリックレベル（0 = レリック不要） */
  requiredRelicLevel: number;
  /** リーダー指定かどうか */
  isLeader: boolean;
  /** メモ（キャラの表示名など） */
  note: string;
}

export interface SpecialMissionSquad {
  squadId: string;
  squadName: string;
  units: SpecialMissionUnit[];
}

export interface SpecialMission {
  missionId: string;
  missionName: string;
  description: string;
  squads: SpecialMissionSquad[];
}

export interface SpecialMissionZone {
  zoneId: string;
  zoneName: string;
  specialMissions: SpecialMission[];
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
 * Platoon / SpecialMission 両方から集約して使う
 */
export interface UnitRequirement {
  /** ComlinkのユニットID */
  id: string;
  /** 必要レリックレベル */
  requiredRelicLevel: number;
  /** この要件の出所（小隊 or スペシャルミッション） */
  source: "platoon" | "special_mission";
  /** 出所の詳細（例: "Phase 1 > Dark Side > Platoon 1"） */
  sourceLabel: string;
  /** メモ（キャラの表示名など） */
  note: string;
}
