#!/usr/bin/env bun
/**
 * SWGoH Advisor CLI
 * 使い方: bun run cli
 *
 * 起動後に対話形式でアライコード・モード・目的を選択し、
 * AIとチャット形式でアドバイスを受ける。
 */

import { fetchPlayerData } from "../core/comlink/client.ts";
import { formatPlayer } from "../core/comlink/formatPlayer.ts";
import {
  createModel,
  DEFAULT_PROVIDER,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_DISPLAY_NAMES,
} from "../core/advisor/providers.ts";
import { loadLastAllyCode, saveAllyCode } from "./config.ts";
import { createReadline, askAllyCode, confirm } from "./selector.ts";
import { runChatSession } from "./chat.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

const VERSION = "0.2.0";

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

function printError(message: string): void {
  console.error(`\n❌ エラー: ${message}\n`);
}

function printStep(step: string): void {
  process.stdout.write(`\n⏳ ${step}...`);
}

function printStepDone(result: string): void {
  process.stdout.write(`\r✅ ${result}${" ".repeat(10)}\n`);
}

// -------------------------------------------------------
// アライコード解決
// -------------------------------------------------------

/**
 * アライコードを対話形式で確認・取得する
 *
 * - 初回: 入力を求める
 * - 2回目以降: 前回のアライコードを確認し、変更する場合は再入力
 *
 * @param rl - readline.Interface インスタンス
 * @returns 確定したアライコード文字列
 */
async function resolveAllyCode(
  rl: import("readline").Interface,
): Promise<string> {
  const last = loadLastAllyCode();

  if (last !== undefined) {
    const useLast = await confirm(
      rl,
      `前回のアライコード: ${last} で続けますか？`,
      true,
    );
    if (useLast) {
      return last;
    }
  }

  const allyCode = await askAllyCode(rl);
  saveAllyCode(allyCode);
  return allyCode;
}

// -------------------------------------------------------
// メイン処理
// -------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n🚀 SWGoH Advisor CLI v${VERSION}`);
  console.log("─".repeat(50));

  const rl = createReadline();

  try {
    // Step 1: アライコード確認
    const allyCode = await resolveAllyCode(rl);

    // Step 2: プレイヤーデータ取得
    printStep("Comlinkからプレイヤーデータを取得中");
    const rawPlayer = await fetchPlayerData(allyCode);
    printStepDone(
      `プレイヤーデータ取得完了: ${rawPlayer.name} (Lv.${rawPlayer.level})`,
    );

    // Step 3: プレイヤーデータ整形
    printStep("プレイヤーデータを整形中");
    const player = formatPlayer(rawPlayer);
    printStepDone(
      `整形完了: 全 ${player.units.size} キャラ`,
    );

    // Step 4: AIモデル準備（デフォルトプロバイダー）
    const model = createModel(DEFAULT_PROVIDER);
    const providerName = PROVIDER_DISPLAY_NAMES[DEFAULT_PROVIDER];
    const modelId = PROVIDER_DEFAULT_MODELS[DEFAULT_PROVIDER];
    console.log(`\n🤖 AIプロバイダー: ${providerName} (${modelId})`);
    console.log("─".repeat(50));

    // Step 5: チャットセッション開始
    const comlinkBaseUrl = process.env["COMLINK_URL"];
    await runChatSession({
      rl,
      model,
      player,
      ...(comlinkBaseUrl ? { comlinkBaseUrl } : {}),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      printError(error.message);
      if (process.env["DEBUG"] === "1") {
        console.error(error.stack);
      }
    } else {
      printError("予期しないエラーが発生しました。");
      console.error(error);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

// -------------------------------------------------------
// エントリーポイント
// -------------------------------------------------------

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`\n❌ エラー: ${error.message}\n`);
    if (process.env["DEBUG"] === "1") {
      console.error(error.stack);
    }
  } else {
    console.error("\n❌ 予期しないエラーが発生しました。\n");
    console.error(error);
  }
  process.exit(1);
});
