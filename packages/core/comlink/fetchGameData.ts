/**
 * Comlink /data エンドポイントからゲームデータを取得する
 * requestSegment:2 (territoryBattleDefinition) と
 * requestSegment:4 (campaign) を取得する
 */

import { ComlinkError } from "./client.ts";
import type {
  ComlinkDataSegment2Response,
  ComlinkDataSegment4Response,
} from "./types.ts";
import type { ComlinkClientConfig } from "./client.ts";

const DEFAULT_COMLINK_URL = "http://localhost:5001";

// -------------------------------------------------------
// /metadata からバージョン取得
// -------------------------------------------------------

/**
 * Comlinkから最新のゲームデータバージョン文字列を取得する
 */
async function fetchLatestGameDataVersion(baseUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new ComlinkError(
      `Comlinkへの接続に失敗しました。Dockerが起動しているか確認してください。\n詳細: ${message}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(body取得失敗)");
    throw new ComlinkError(
      `Comlinkの /metadata がエラーを返しました。`,
      response.status,
      body,
    );
  }

  const data = await response.json() as { latestGamedataVersion?: string };
  const version = data.latestGamedataVersion;
  if (!version) {
    throw new ComlinkError("latestGamedataVersion が metadata に含まれていません。");
  }
  return version;
}

// -------------------------------------------------------
// /data 共通フェッチ
// -------------------------------------------------------

async function fetchDataSegment(
  baseUrl: string,
  version: string,
  requestSegment: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { version, requestSegment },
        enums: false,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new ComlinkError(
      `Comlink /data (segment:${requestSegment}) への接続に失敗しました。\n詳細: ${message}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(body取得失敗)");
    throw new ComlinkError(
      `Comlink /data (segment:${requestSegment}) がエラーを返しました。`,
      response.status,
      body,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ComlinkError(
      `Comlink /data (segment:${requestSegment}) のレスポンスをパースできませんでした。`,
    );
  }

  return data;
}

// -------------------------------------------------------
// 公開API
// -------------------------------------------------------

/**
 * requestSegment:2 のデータを取得する
 * 含まれるコレクション: territoryBattleDefinition など
 */
export async function fetchDataSegment2(
  config: ComlinkClientConfig = {},
): Promise<ComlinkDataSegment2Response> {
  const baseUrl = config.baseUrl ?? DEFAULT_COMLINK_URL;
  const version = await fetchLatestGameDataVersion(baseUrl);
  const data = await fetchDataSegment(baseUrl, version, 2);
  return data as ComlinkDataSegment2Response;
}

/**
 * requestSegment:4 のデータを取得する
 * 含まれるコレクション: campaign など
 */
export async function fetchDataSegment4(
  config: ComlinkClientConfig = {},
): Promise<ComlinkDataSegment4Response> {
  const baseUrl = config.baseUrl ?? DEFAULT_COMLINK_URL;
  const version = await fetchLatestGameDataVersion(baseUrl);
  const data = await fetchDataSegment(baseUrl, version, 4);
  return data as ComlinkDataSegment4Response;
}

/**
 * segment:2 と segment:4 を並列取得して返す
 * 呼び出し元はこれを使えば1回の await で両方取れる
 */
export async function fetchRoteRawData(
  config: ComlinkClientConfig = {},
): Promise<{
  segment2: ComlinkDataSegment2Response;
  segment4: ComlinkDataSegment4Response;
}> {
  const baseUrl = config.baseUrl ?? DEFAULT_COMLINK_URL;
  // version は1回だけ取得して両セグメントで共有する
  const version = await fetchLatestGameDataVersion(baseUrl);

  const [segment2, segment4] = await Promise.all([
    fetchDataSegment(baseUrl, version, 2),
    fetchDataSegment(baseUrl, version, 4),
  ]);

  return {
    segment2: segment2 as ComlinkDataSegment2Response,
    segment4: segment4 as ComlinkDataSegment4Response,
  };
}
