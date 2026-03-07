/**
 * Comlinkの生データからRotE TBデータを解析するパーサー
 *
 * segment:2 の territoryBattleDefinition と
 * segment:4 の campaign を突合して以下を生成する:
 *   - スペシャルミッション一覧（必須キャラ・レリック要件・クリア報酬）
 *   - 各ゾームの星閾値
 */

import type {
  ComlinkDataSegment2Response,
  ComlinkDataSegment4Response,
  ComlinkCovertZoneDefinition,
  RoteGameData,
  RoteSpecialMissionData,
  RoteSMReward,
} from "./types.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

const ROTE_TB_ID = "t05D";
const ROTE_CAMPAIGN_MAP_ID = "TB_TB3_MIXED_BATTLE";

/**
 * Comlinkの内部レリックTier値 → 実際のレリックレベルへの変換
 *
 * Comlinkの minimumRelicTier は内部値で +2 オフセットが掛かっている
 * （/player の relic.currentTier と同じ仕様）
 *
 * 例:
 *   1 → R未解放(0)
 *   7 → R5
 *   9 → R7
 *  10 → R8
 *  11 → R9
 */
function toRelicLevel(internalTier: number): number {
  // 内部値 1 はレリック未解放（R0扱い）
  if (internalTier <= 2) return 0;
  return internalTier - 2;
}

/**
 * ミッションIDからフェーズ番号を抽出する
 * 例: "PHASE3_TERRITORY_01_SPECIALMISSION" -> 3
 */
function extractPhaseNumber(missionId: string): number {
  const match = missionId.match(/^PHASE(\d+)_/);
  return match ? parseInt(match[1], 10) : 0;
}

// -------------------------------------------------------
// SM解析
// -------------------------------------------------------

/**
 * covertZoneDefinition を campaignMissionId でインデックス化する
 */
function indexCovertByMissionId(
  covertZones: ComlinkCovertZoneDefinition[],
): Map<string, ComlinkCovertZoneDefinition> {
  const map = new Map<string, ComlinkCovertZoneDefinition>();
  for (const cz of covertZones) {
    const missionId = cz.campaignElementIdentifier?.campaignMissionId;
    if (missionId) {
      map.set(missionId, cz);
    }
  }
  return map;
}

/**
 * segment:2 と segment:4 の生データからSM一覧を生成する
 */
function parseSpecialMissions(
  segment2: ComlinkDataSegment2Response,
  segment4: ComlinkDataSegment4Response,
): RoteSpecialMissionData[] {
  // ---- segment:2 から covertZoneDefinition を取得 ----
  const roteTbd = segment2.territoryBattleDefinition?.find(
    (tb) => tb.id === ROTE_TB_ID,
  );
  if (!roteTbd) {
    throw new Error(`territoryBattleDefinition に ${ROTE_TB_ID} が見つかりません`);
  }

  const covertByMissionId = indexCovertByMissionId(
    roteTbd.covertZoneDefinition ?? [],
  );

  // ---- segment:4 から campaign を取得 ----
  const roteCampaign = segment4.campaign?.find((c) => c.id === ROTE_TB_ID);
  if (!roteCampaign) {
    throw new Error(`campaign に ${ROTE_TB_ID} が見つかりません`);
  }

  const tbMap = roteCampaign.campaignMap?.find(
    (m) => m.id === ROTE_CAMPAIGN_MAP_ID,
  );
  if (!tbMap) {
    throw new Error(`campaignMap に ${ROTE_CAMPAIGN_MAP_ID} が見つかりません`);
  }

  // ---- 全ミッションを走査してSPECIALMISSIONのみ抽出 ----
  const results: RoteSpecialMissionData[] = [];

  for (const dg of tbMap.campaignNodeDifficultyGroup ?? []) {
    for (const node of dg.campaignNode ?? []) {
      for (const mission of node.campaignNodeMission ?? []) {
        const missionId = mission.id ?? "";
        if (!missionId.includes("SPECIALMISSION")) continue;

        const ec = mission.entryCategoryAllowed;
        const mandatoryUnitIds =
          ec?.mandatoryRosterUnit?.map((u) => u.id) ?? [];
        const categoryIds = ec?.categoryId ?? [];
        const minimumRelicLevel = toRelicLevel(ec?.minimumRelicTier ?? 0);
        const maxUnitCount = ec?.maximumAllowedUnitQuantity ?? 0;

        // covertZoneDefinition から報酬を取得（なければ空配列）
        const covert = covertByMissionId.get(missionId);
        const rewards: RoteSMReward[] = covert
          ? (covert.victoryReward ?? []).map((r) => ({
              itemId: r.id,
              quantity: r.minQuantity,
            }))
          : [];

        // linkedConflictId: covertがある場合はそこから、なければ空文字
        const linkedConflictId =
          covert?.zoneDefinition?.linkedConflictId ?? "";

        results.push({
          missionId,
          phase: extractPhaseNumber(missionId),
          linkedConflictId,
          mandatoryUnitIds,
          categoryIds,
          minimumRelicLevel,
          maxUnitCount,
          rewards,
        });
      }
    }
  }

  // フェーズ順にソート
  results.sort((a, b) => a.phase - b.phase || a.missionId.localeCompare(b.missionId));

  return results;
}

// -------------------------------------------------------
// 星閾値解析
// -------------------------------------------------------

/**
 * segment:2 の conflictZoneDefinition から全ゾームの星閾値を生成する
 *
 * 各ゾームには最大3件の victoryPointRewards があり、
 * galacticScoreRequirement が ★1/★2/★3 の閾値に対応する
 */
function parseZoneStarThresholds(
  segment2: ComlinkDataSegment2Response,
): RoteGameData["zoneStarThresholds"] {
  const roteTbd = segment2.territoryBattleDefinition?.find(
    (tb) => tb.id === ROTE_TB_ID,
  );
  if (!roteTbd) return [];

  return (roteTbd.conflictZoneDefinition ?? []).map((zone) => {
    const zoneId = zone.zoneDefinition?.zoneId ?? "";
    // galacticScoreRequirement は文字列で格納されているため数値変換
    const sorted = (zone.victoryPointRewards ?? [])
      .map((v) => parseInt(v.galacticScoreRequirement, 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

    // 不足分は0で補完して必ず3要素にする
    const thresholds: [number, number, number] = [
      sorted[0] ?? 0,
      sorted[1] ?? 0,
      sorted[2] ?? 0,
    ];

    return { zoneId, thresholds };
  });
}

// -------------------------------------------------------
// 公開API
// -------------------------------------------------------

/**
 * segment:2 と segment:4 の生データから RoteGameData を生成する
 *
 * fetchRoteRawData() の結果をそのまま渡せる。
 */
export function parseRoteGameData(
  segment2: ComlinkDataSegment2Response,
  segment4: ComlinkDataSegment4Response,
): RoteGameData {
  return {
    specialMissions: parseSpecialMissions(segment2, segment4),
    zoneStarThresholds: parseZoneStarThresholds(segment2),
  };
}
