/**
 * fetchRoteData - 起動時1回キャッシュ付きのRotE TBデータ取得関数
 *
 * 使い方:
 *   // アプリ起動時に1回呼ぶ
 *   const roteData = await fetchRoteData();
 *
 *   // 2回目以降はキャッシュから返る（Comlinkへのリクエストなし）
 *   const roteData = await fetchRoteData();
 */

import { fetchRoteRawData } from "./fetchGameData.ts";
import { parseRoteGameData } from "./parseRoteData.ts";
import type { RoteGameData } from "./types.ts";
import type { ComlinkClientConfig } from "./client.ts";

// -------------------------------------------------------
// インメモリキャッシュ
// -------------------------------------------------------

let cache: RoteGameData | null = null;

// -------------------------------------------------------
// 公開API
// -------------------------------------------------------

/**
 * RotE TBのゲームデータを取得する（起動時1回キャッシュ）
 *
 * - 初回呼び出し: Comlinkの /data (segment:2 + segment:4) を取得・解析してキャッシュ
 * - 2回目以降: キャッシュを返す（Comlinkへのリクエストなし）
 * - キャッシュをクリアしたい場合は clearRoteDataCache() を呼ぶ
 *
 * @param config - ComlinkのURL設定（省略時: http://localhost:5001）
 */
export async function fetchRoteData(
  config: ComlinkClientConfig = {},
): Promise<RoteGameData> {
  if (cache !== null) {
    return cache;
  }

  const { segment2, segment4 } = await fetchRoteRawData(config);
  cache = parseRoteGameData(segment2, segment4);
  return cache;
}

/**
 * キャッシュをクリアする
 *
 * ゲームアップデート後に最新データを再取得させたい場合や
 * テスト時に使う。
 */
export function clearRoteDataCache(): void {
  cache = null;
}
