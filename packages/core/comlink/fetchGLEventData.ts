/**
 * fetchGLEventData - GL イベントデータ取得関数（キャッシュ付き）
 *
 * 使い方:
 *   // アプリ起動時に1回呼ぶ
 *   const jabbaGLData = await fetchGLEventData("CAMPAIGN_EVENT_JABBA_GALACTICLEGEND");
 *
 *   // 2回目以降はキャッシュから返る（Comlinkへのリクエストなし）
 *   const jabbaGLData = await fetchGLEventData("CAMPAIGN_EVENT_JABBA_GALACTICLEGEND");
 */

import { fetchDataSegment4 } from "./fetchGameData.ts";
import { parseGLEventData, parseAllGLEventData } from "./parseGLEventData.ts";
import type { GLEventData, ComlinkDataSegment4Response } from "./types.ts";
import type { ComlinkClientConfig } from "./client.ts";

// -------------------------------------------------------
// インメモリキャッシュ
// -------------------------------------------------------

/** 全GL イベントデータのキャッシュ */
let glEventsCache: Map<string, GLEventData> | null = null;

/** segment:4 の生データキャッシュ */
let segment4Cache: ComlinkDataSegment4Response | null = null;

// -------------------------------------------------------
// 公開API
// -------------------------------------------------------

/**
 * 指定した GL イベントのデータを取得する（起動時キャッシュ）
 *
 * - 初回呼び出し: Comlink の /data (segment:4) を取得・解析してキャッシュ
 * - 2回目以降: キャッシュから返す（Comlinkへのリクエストなし）
 * - キャッシュをクリアしたい場合は clearGLEventDataCache() を呼ぶ
 *
 * @param nodeId - GL イベント node ID（例: "CAMPAIGN_EVENT_JABBA_GALACTICLEGEND"）
 * @param config - ComlinkのURL設定（省略時: http://localhost:5001）
 * @returns GL イベントのデータ、またはnull（見つからない場合）
 */
export async function fetchGLEventData(
  nodeId: string,
  config: ComlinkClientConfig = {},
): Promise<GLEventData | null> {
  // キャッシュを初期化していれば、そこから取得
  if (glEventsCache === null) {
    await initializeGLEventCache(config);
  }

  return glEventsCache?.get(nodeId) || null;
}

/**
 * 全ての GL イベントデータを取得する
 *
 * @param config - ComlinkのURL設定（省略時: http://localhost:5001）
 * @returns GL イベントデータの配列
 */
export async function fetchAllGLEventData(
  config: ComlinkClientConfig = {},
): Promise<GLEventData[]> {
  if (glEventsCache === null) {
    await initializeGLEventCache(config);
  }

  return Array.from(glEventsCache?.values() || []);
}

/**
 * キャッシュをクリアする
 */
export function clearGLEventDataCache(): void {
  glEventsCache = null;
  segment4Cache = null;
}

// -------------------------------------------------------
// 内部ヘルパー関数
// -------------------------------------------------------

/**
 * GL イベントキャッシュを初期化する
 * segment:4 を取得して全ての GL イベントを解析してキャッシュする
 */
async function initializeGLEventCache(
  config: ComlinkClientConfig = {},
): Promise<void> {
  // segment:4 を取得
  segment4Cache = await fetchDataSegment4(config);

  // 全 GL イベントを解析
  const allGLEvents = parseAllGLEventData(segment4Cache);

  // Map にキャッシュ
  glEventsCache = new Map();
  for (const glEvent of allGLEvents) {
    glEventsCache.set(glEvent.nodeId, glEvent);
  }
}
