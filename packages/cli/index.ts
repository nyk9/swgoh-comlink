#!/usr/bin/env bun
/**
 * SWGoH Advisor CLI
 * 使い方: bun run index.ts <allyCode> --tb rote [--provider google|anthropic] [--model <modelId>]
 */

import { fetchPlayerData } from "../core/comlink/client.ts";
import { formatPlayer, filterUnitsByIds } from "../core/comlink/formatPlayer.ts";
import {
  getAllRoteRequirements,
  getAllRoteUnitIds,
  getMaxRelicRequirementsMap,
} from "../core/data/roteData.ts";
import { generateRoteTBAdvice } from "../core/advisor/client.ts";
import {
  createModel,
  isValidProviderId,
  DEFAULT_PROVIDER,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_API_KEY_ENV_VARS,
} from "../core/advisor/providers.ts";
import type { ProviderId } from "../core/advisor/providers.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

const VERSION = "0.1.0";

const HELP_TEXT = `
SWGoH Advisor CLI v${VERSION}

使い方:
  bun run index.ts <allyCode> [options]

引数:
  allyCode                  プレイヤーのアライコード（9桁の数字）

オプション:
  --tb <mode>               テリトリーバトルモード（現在は "rote" のみ対応）
  --provider <id>           使用するAIプロバイダー（デフォルト: ${DEFAULT_PROVIDER}）
                            対応プロバイダー: google, anthropic
  --model <modelId>         使用するモデルID（省略時はプロバイダーのデフォルトを使用）
  --comlink-url <url>       ComlinkのベースURL（デフォルト: http://localhost:5001）
  --max-tokens <number>     最大出力トークン数（デフォルト: 2048）
  --help, -h                このヘルプを表示
  --version, -v             バージョンを表示

プロバイダー別デフォルトモデル:
  google      ${PROVIDER_DEFAULT_MODELS.google}  ← 無料枠あり、テスト推奨
  anthropic   ${PROVIDER_DEFAULT_MODELS.anthropic}

必要な環境変数（.env ファイルに設定）:
  google      GOOGLE_GENERATIVE_AI_API_KEY
  anthropic   ANTHROPIC_API_KEY

例:
  bun run index.ts 445833733 --tb rote
  bun run index.ts 445833733 --tb rote --provider anthropic
  bun run index.ts 445833733 --tb rote --provider google --model gemini-2.5-flash
`.trim();

// -------------------------------------------------------
// 引数パース
// -------------------------------------------------------

interface CliArgs {
  allyCode: string;
  tbMode: string | null;
  providerId: string | undefined;
  modelId: string | undefined;
  comlinkUrl: string | undefined;
  maxOutputTokens: number | undefined;
  help: boolean;
  version: boolean;
}

/**
 * process.argv を解析して CliArgs に変換する
 */
function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // 先頭2つ（bun, index.ts）を除く

  let allyCode = "";
  let tbMode: string | null = null;
  let providerId: string | undefined;
  let modelId: string | undefined;
  let comlinkUrl: string | undefined;
  let maxOutputTokens: number | undefined;
  let help = false;
  let version = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg == null) continue;

    switch (arg) {
      case "--help":
      case "-h":
        help = true;
        break;

      case "--version":
      case "-v":
        version = true;
        break;

      case "--tb": {
        const next = args[i + 1];
        if (next == null || next.startsWith("--")) {
          printError('--tb オプションには値が必要です。例: --tb rote');
          process.exit(1);
        }
        tbMode = next;
        i++;
        break;
      }

      case "--provider": {
        const next = args[i + 1];
        if (next == null || next.startsWith("--")) {
          printError('--provider オプションには値が必要です。例: --provider google');
          process.exit(1);
        }
        providerId = next;
        i++;
        break;
      }

      case "--model": {
        const next = args[i + 1];
        if (next == null || next.startsWith("--")) {
          printError('--model オプションには値が必要です。例: --model gemini-2.0-flash-lite');
          process.exit(1);
        }
        modelId = next;
        i++;
        break;
      }

      case "--comlink-url": {
        const next = args[i + 1];
        if (next == null || next.startsWith("--")) {
          printError('--comlink-url オプションには値が必要です。');
          process.exit(1);
        }
        comlinkUrl = next;
        i++;
        break;
      }

      case "--max-tokens": {
        const next = args[i + 1];
        if (next == null || next.startsWith("--")) {
          printError('--max-tokens オプションには値が必要です。');
          process.exit(1);
        }
        const parsed = parseInt(next, 10);
        if (isNaN(parsed) || parsed <= 0) {
          printError('--max-tokens には正の整数を指定してください。');
          process.exit(1);
        }
        maxOutputTokens = parsed;
        i++;
        break;
      }

      default:
        if (!arg.startsWith("--") && allyCode === "") {
          allyCode = arg;
        } else if (!arg.startsWith("--")) {
          printError(`不明な引数: ${arg}`);
          process.exit(1);
        } else {
          printError(`不明なオプション: ${arg}\n\n${HELP_TEXT}`);
          process.exit(1);
        }
    }
  }

  return { allyCode, tbMode, providerId, modelId, comlinkUrl, maxOutputTokens, help, version };
}

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

function printError(message: string): void {
  console.error(`\n❌ エラー: ${message}\n`);
}

function printStep(step: string): void {
  console.log(`\n⏳ ${step}...`);
}

function printSuccess(step: string): void {
  console.log(`✅ ${step}`);
}

// -------------------------------------------------------
// バリデーション
// -------------------------------------------------------

function validateAllyCode(allyCode: string): void {
  if (allyCode === "") {
    printError(`allyCode を指定してください。\n\n${HELP_TEXT}`);
    process.exit(1);
  }
  if (!/^\d{9}$/.test(allyCode)) {
    printError(`allyCode は9桁の数字で指定してください。指定された値: "${allyCode}"`);
    process.exit(1);
  }
}

function validateTbMode(tbMode: string | null): void {
  if (tbMode == null) {
    printError('--tb オプションを指定してください。例: --tb rote');
    process.exit(1);
  }
  const supported = ["rote"];
  if (!supported.includes(tbMode)) {
    printError(`未対応のTBモード: "${tbMode}"\n対応しているモード: ${supported.join(", ")}`);
    process.exit(1);
  }
}

/**
 * --provider の値を検証して ProviderId を返す
 * 無効な値の場合はエラーを表示して終了する
 */
function resolveProviderId(raw: string | undefined): ProviderId {
  if (raw === undefined) return DEFAULT_PROVIDER;

  if (!isValidProviderId(raw)) {
    printError(
      `未対応のプロバイダー: "${raw}"\n対応しているプロバイダー: google, anthropic`,
    );
    process.exit(1);
  }
  return raw;
}

// -------------------------------------------------------
// メイン処理
// -------------------------------------------------------

async function main(): Promise<void> {
  const {
    allyCode,
    tbMode,
    providerId: rawProviderId,
    modelId,
    comlinkUrl,
    maxOutputTokens,
    help,
    version,
  } = parseArgs(process.argv);

  // --help / --version
  if (help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (version) {
    console.log(`SWGoH Advisor CLI v${VERSION}`);
    process.exit(0);
  }

  // バリデーション
  validateAllyCode(allyCode);
  validateTbMode(tbMode);
  const providerId = resolveProviderId(rawProviderId);

  // モデルインスタンスを生成（プロバイダーとモデルIDが確定するのはここ）
  const model = createModel(providerId, modelId);
  const resolvedModelId = modelId ?? PROVIDER_DEFAULT_MODELS[providerId];
  const providerDisplayName = PROVIDER_DISPLAY_NAMES[providerId];
  const apiKeyEnvVar = PROVIDER_API_KEY_ENV_VARS[providerId];

  console.log(`\n🚀 SWGoH Advisor CLI v${VERSION}`);
  console.log(`   allyCode : ${allyCode}`);
  console.log(`   モード   : ${tbMode}`);
  console.log(`   プロバイダー: ${providerDisplayName} (${resolvedModelId})`);
  console.log(`   APIキー  : 環境変数 ${apiKeyEnvVar} を使用`);
  console.log("─".repeat(50));

  // Step 1: プレイヤーデータ取得
  printStep("Comlinkからプレイヤーデータを取得中");
  const rawPlayer = await fetchPlayerData(allyCode, {
    ...(comlinkUrl !== undefined && { baseUrl: comlinkUrl }),
  });
  printSuccess(`プレイヤーデータ取得完了: ${rawPlayer.name} (Lv.${rawPlayer.level})`);

  // Step 2: プレイヤーデータ整形
  printStep("プレイヤーデータを整形中");
  const player = formatPlayer(rawPlayer);

  // RotE TBで必要なユニットに絞り込む
  const roteUnitIds = getAllRoteUnitIds();
  const filteredUnits = filterUnitsByIds(player, roteUnitIds);
  const playerWithFilteredUnits = { ...player, units: filteredUnits };

  printSuccess(
    `整形完了: RotE関連キャラ ${filteredUnits.size} / 全キャラ ${player.units.size} キャラを対象`,
  );

  // Step 3: RotE TBデータ読み込み
  printStep("RotE TBデータを読み込み中");
  const requirements = getAllRoteRequirements();
  const maxRelicRequirementsMap = getMaxRelicRequirementsMap();
  printSuccess(`RotE TBデータ読み込み完了: ${requirements.length} 件の要件`);

  // Step 4: AIアドバイス生成
  printStep(`${providerDisplayName} でアドバイスを生成中（少し時間がかかります）`);
  const advice = await generateRoteTBAdvice(
    {
      player: playerWithFilteredUnits,
      requirements,
      maxRelicRequirementsMap,
    },
    {
      model,
      ...(maxOutputTokens !== undefined && { maxOutputTokens }),
    },
  );
  printSuccess("アドバイス生成完了");

  // Step 5: アドバイス表示
  console.log("\n" + "═".repeat(50));
  console.log("📋 RotE TB 育成アドバイス");
  console.log("═".repeat(50) + "\n");
  console.log(advice);
  console.log("\n" + "═".repeat(50));
}

// -------------------------------------------------------
// エントリーポイント
// -------------------------------------------------------

main().catch((error: unknown) => {
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
});
