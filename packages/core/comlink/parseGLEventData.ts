/**
 * Comlink の campaign データから GL イベント情報を解析するパーサー
 *
 * EVENTS > GALACTIC のノードから特定の GL キャラクターのイベント要件を抽出して整形する
 */

import type {
  ComlinkDataSegment4Response,
  ComlinkEntryCategoryAllowed,
  GLEventData,
  GLEventTierData,
} from "./types.ts";

/**
 * Comlinkの内部レリックTier値 → 実際のレリックレベルへの変換
 *
 * 内部値は +2 オフセットが掛かっている
 * 例: 1 → R0, 7 → R5, 9 → R7, 10 → R8, 11 → R9
 */
function toRelicLevel(internalTier: number): number {
  if (internalTier <= 2) return 0;
  return internalTier - 2;
}

/**
 * Tier ID から Tier 番号を抽出する
 * 例: "TIER01" → 1, "TIER05" → 5
 */
function extractTierNumber(tierId: string): number {
  const match = tierId.match(/TIER(\d+)/i);
  return match ? parseInt(match[1]!, 10) : 0;
}

/**
 * GL イベント node ID から GL キャラクター ID を抽出する
 * 例: "CAMPAIGN_EVENT_JABBA_GALACTICLEGEND" → "JABBATHEHUTT"
 * 例: "CAMPAIGN_EVENT_REY_GALACTICLEGEND" → "GLREY"
 *
 * mapping: GL node ID → GL キャラクター ID の対応表
 */
const GL_CHARACTER_ID_MAPPING: Record<string, string> = {
  CAMPAIGN_EVENT_JABBA_GALACTICLEGEND: "JABBATHEHUTT",
  CAMPAIGN_EVENT_REY_GALACTICLEGEND: "GLREY",
  CAMPAIGN_EVENT_KYLOREN_GALACTICLEGEND: "SUPREMELEADERKYLOREN",
  CAMPAIGN_EVENT_LUKE_GALACTICLEGEND: "GRANDMASTERLUKE",
  CAMPAIGN_EVENT_SITHETERNALEMPEROR_GALACTICLEGEND: "SITHETERNALEMPEROR",
  CAMPAIGN_EVENT_KENOBI_GALACTICLEGEND: "JEDIMASTER_KENOBI_GALACTICLEGEND",
  CAMPAIGN_EVENT_VADER_GALACTICLEGEND: "DARTHVADER_SITH_ETERNAL",
  CAMPAIGN_EVENT_LEIAORGANA_GALACTICLEGEND: "GLLEIA",
  CAMPAIGN_EVENT_AHSOKATANO_GALACTICLEGEND: "GLAHSOKATANO",
  CAMPAIGN_EVENT_HONDOOHNAKA_GALACTICLEGEND: "GLHONDO",
};

/**
 * entryCategoryAllowed から 1 Tier 分のデータを抽出する
 */
function parseTierData(
  tierId: string,
  ec: ComlinkEntryCategoryAllowed,
): GLEventTierData {
  const mandatoryUnitIds =
    ec.mandatoryRosterUnit?.map((u) => u.id) ?? [];
  const categoryIds = ec.categoryId ?? [];
  const minimumStars = ec.minimumUnitRarity ?? 0;
  const minimumRelicLevel = toRelicLevel(ec.minimumRelicTier ?? 0);
  const minUnitCount = ec.minimumRequiredUnitQuantity ?? 0;
  const maxUnitCount = ec.maximumAllowedUnitQuantity ?? 0;

  return {
    tierNumber: extractTierNumber(tierId),
    tierId,
    mandatoryUnitIds,
    categoryIds,
    minimumStars,
    minimumRelicLevel,
    minUnitCount,
    maxUnitCount,
  };
}

/**
 * segment:4 のデータから指定した GL イベントを検索して解析する
 *
 * @param data segment:4 のレスポンスデータ
 * @param nodeId GL イベント node ID（例: "CAMPAIGN_EVENT_JABBA_GALACTICLEGEND"）
 * @returns GL イベントの全 Tier 情報、またはnull（見つからない場合）
 */
export function parseGLEventData(
  data: ComlinkDataSegment4Response,
  nodeId: string,
): GLEventData | null {
  // EVENTS campaign を探す
  const eventsCampaign = data.campaign?.find((c) => c.id === "EVENTS");
  if (!eventsCampaign) {
    console.warn("❌ EVENTS campaign が見つかりません");
    return null;
  }

  // GALACTIC campaignMap を探す
  const galacticMap = eventsCampaign.campaignMap?.find(
    (m) => m.id === "GALACTIC",
  );
  if (!galacticMap) {
    console.warn("❌ EVENTS > GALACTIC が見つかりません");
    return null;
  }

  // 指定した nodeId を探す
  let foundNode: any = null;
  for (const diffGroup of galacticMap.campaignNodeDifficultyGroup ?? []) {
    for (const node of diffGroup.campaignNode ?? []) {
      if (node.id === nodeId) {
        foundNode = node;
        break;
      }
    }
    if (foundNode) break;
  }

  if (!foundNode) {
    console.warn(`❌ GL イベント node "${nodeId}" が見つかりません`);
    return null;
  }

  // 全ミッション（Tier）を解析
  const tiers: GLEventTierData[] = [];
  for (const mission of foundNode.campaignNodeMission ?? []) {
    const ec = mission.entryCategoryAllowed;
    if (!ec) continue;

    const tierData = parseTierData(mission.id!, ec);
    tiers.push(tierData);
  }

  // Tier 番号順にソート
  tiers.sort((a, b) => a.tierNumber - b.tierNumber);

  // GL キャラクター ID を取得
  const characterId = GL_CHARACTER_ID_MAPPING[nodeId] || nodeId;

  return {
    characterId,
    nodeId,
    tiers,
  };
}

/**
 * segment:4 のデータから全ての GL イベントを検索して解析する
 *
 * @param data segment:4 のレスポンスデータ
 * @returns GL イベントの配列（複数存在する可能性がある）
 */
export function parseAllGLEventData(
  data: ComlinkDataSegment4Response,
): GLEventData[] {
  const results: GLEventData[] = [];

  // EVENTS > GALACTIC を探す
  const eventsCampaign = data.campaign?.find((c) => c.id === "EVENTS");
  if (!eventsCampaign) return results;

  const galacticMap = eventsCampaign.campaignMap?.find(
    (m) => m.id === "GALACTIC",
  );
  if (!galacticMap) return results;

  // 全ノードを走査して CAMPAIGN_EVENT_*_GALACTICLEGEND パターンを探す
  for (const diffGroup of galacticMap.campaignNodeDifficultyGroup ?? []) {
    for (const node of diffGroup.campaignNode ?? []) {
      const nodeId = node.id ?? "";

      // GL イベントノードかどうか判定
      if (!nodeId.includes("CAMPAIGN_EVENT") || !nodeId.includes("GALACTICLEGEND")) {
        continue;
      }

      // このノードの GL イベントデータを解析
      const glData = parseGLEventData(data, nodeId);
      if (glData) {
        results.push(glData);
      }
    }
  }

  return results;
}

/**
 * GL イベント node ID から GL キャラクター ID を取得する
 * マッピング表に定義されていない場合は nodeId をそのまま返す
 */
export function getGLCharacterId(nodeId: string): string {
  return GL_CHARACTER_ID_MAPPING[nodeId] || nodeId;
}
