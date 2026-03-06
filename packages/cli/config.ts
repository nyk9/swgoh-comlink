/**
 * CLI 設定ファイル管理モジュール
 *
 * アライコード等のCLI固有の設定を ~/.swgoh-advisor/config.json に保存・読み込みする。
 * この責務はCLI専用であり、core/ には含めない。
 * Web・Discordではそれぞれのセッション/DBで管理する。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

const CONFIG_DIR = join(homedir(), ".swgoh-advisor");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

export interface CliConfig {
  /** 前回使用したアライコード（9桁の数字文字列） */
  lastAllyCode?: string;
}

// -------------------------------------------------------
// 内部ユーティリティ
// -------------------------------------------------------

/**
 * 設定ディレクトリが存在しない場合は作成する
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// -------------------------------------------------------
// 公開API
// -------------------------------------------------------

/**
 * 設定ファイルを読み込む
 * ファイルが存在しない場合・パースエラーの場合は空オブジェクトを返す
 *
 * @returns 読み込んだ設定オブジェクト
 */
export function loadConfig(): CliConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    // パースエラーは無視して空の設定を返す
    return {};
  }
}

/**
 * 設定ファイルに書き込む
 * 既存の設定とマージして保存する（上書きではなくマージ）
 *
 * @param updates - 保存したい設定の差分
 */
export function saveConfig(updates: Partial<CliConfig>): void {
  ensureConfigDir();

  const current = loadConfig();
  const merged: CliConfig = { ...current, ...updates };

  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
}

/**
 * 前回使用したアライコードを返す
 * 保存されていない場合は undefined を返す
 *
 * @returns 前回のアライコード文字列、または undefined
 */
export function loadLastAllyCode(): string | undefined {
  return loadConfig().lastAllyCode;
}

/**
 * アライコードを設定ファイルに保存する
 *
 * @param allyCode - 保存するアライコード（9桁の数字文字列）
 */
export function saveAllyCode(allyCode: string): void {
  saveConfig({ lastAllyCode: allyCode });
}
