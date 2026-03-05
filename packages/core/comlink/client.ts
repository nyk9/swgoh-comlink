/**
 * Comlink API クライアント
 * ComlinkへのHTTPリクエストを担当する
 */

import type { ComlinkPlayerResponse } from "./types.ts";

// -------------------------------------------------------
// 設定
// -------------------------------------------------------

const DEFAULT_COMLINK_URL = "http://localhost:5001";

export interface ComlinkClientConfig {
  /** ComlinkのベースURL（デフォルト: http://localhost:5001） */
  baseUrl?: string;
}

// -------------------------------------------------------
// エラー型
// -------------------------------------------------------

export class ComlinkError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "ComlinkError";
  }
}

// -------------------------------------------------------
// /player リクエスト型
// -------------------------------------------------------

interface PlayerRequestBody {
  payload: {
    allyCode: string;
  };
  enums: boolean;
}

// -------------------------------------------------------
// クライアント関数
// -------------------------------------------------------

/**
 * Comlinkから指定したallyCodeのプレイヤーデータを取得する
 *
 * @param allyCode - プレイヤーのアライコード（数字9桁の文字列）
 * @param config - クライアント設定（省略可）
 * @returns 生のComlinkプレイヤーレスポンス
 * @throws {ComlinkError} HTTPエラーやネットワークエラーの場合
 */
export async function fetchPlayerData(
  allyCode: string,
  config: ComlinkClientConfig = {},
): Promise<ComlinkPlayerResponse> {
  const baseUrl = config.baseUrl ?? DEFAULT_COMLINK_URL;
  const url = `${baseUrl}/player`;

  const body: PlayerRequestBody = {
    payload: {
      allyCode,
    },
    enums: false,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new ComlinkError(
      `Comlinkへの接続に失敗しました。Dockerが起動しているか確認してください。\n詳細: ${message}`,
    );
  }

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "(body取得失敗)");
    throw new ComlinkError(
      `Comlinkがエラーを返しました。allyCode: ${allyCode}`,
      response.status,
      responseBody,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ComlinkError("Comlinkのレスポンスをパースできませんでした。");
  }

  // 型アサーション：Comlinkの仕様に基づき、型の整合性はformatPlayer.tsで保証する
  return data as ComlinkPlayerResponse;
}
