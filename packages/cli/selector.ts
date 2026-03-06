/**
 * 選択式UI ユーティリティモジュール
 *
 * CLIでの対話的な選択肢表示・入力受付を担う。
 * readline を使ってユーザーからのキー入力を受け取る。
 */

import * as readline from "readline";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

export interface SelectOption<T extends string = string> {
  /** 表示ラベル */
  label: string;
  /** 選択されたときに返す値 */
  value: T;
}

// -------------------------------------------------------
// readline ユーティリティ
// -------------------------------------------------------

/**
 * readline.Interface を生成して返す
 * process.stdin / stdout を使う
 */
export function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 1行のプロンプトを表示してユーザーの入力を受け取る
 *
 * @param rl     - readline.Interface インスタンス
 * @param prompt - 表示するプロンプト文字列
 * @returns ユーザーが入力した文字列（trim済み）
 */
export function askLine(
  rl: readline.Interface,
  prompt: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

// -------------------------------------------------------
// 選択式UI
// -------------------------------------------------------

/**
 * 選択肢を表示してユーザーに番号で選ばせる
 *
 * 表示例:
 *   1) RotE TB（Rise of the Empire）
 *   2) TW（テリトリーウォー）
 *   3) GAC（グランドアリーナ）
 *
 * - 範囲外の番号や数字以外を入力した場合は再入力を促す
 *
 * @param rl      - readline.Interface インスタンス
 * @param title   - 選択肢の見出し
 * @param options - 選択肢の配列
 * @returns 選択されたオプションの value
 */
export async function select<T extends string>(
  rl: readline.Interface,
  title: string,
  options: SelectOption<T>[],
): Promise<T> {
  console.log(`\n${title}`);
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}) ${options[i]!.label}`);
  }

  while (true) {
    const input = await askLine(rl, "\n番号を入力してください > ");
    const num = parseInt(input, 10);

    if (!isNaN(num) && num >= 1 && num <= options.length) {
      const selected = options[num - 1]!;
      return selected.value;
    }

    console.log(
      `  ⚠️  1〜${options.length} の番号を入力してください。`,
    );
  }
}

/**
 * Yes/No の確認プロンプトを表示する
 *
 * - Enter のみ（空文字）はデフォルト値として扱う
 * - "y" / "Y" → true
 * - "n" / "N" → false
 * - それ以外は再入力を促す
 *
 * @param rl           - readline.Interface インスタンス
 * @param prompt       - 表示するプロンプト文字列
 * @param defaultValue - Enter のみ入力時のデフォルト値（デフォルト: true）
 * @returns ユーザーの選択（true = Yes, false = No）
 */
export async function confirm(
  rl: readline.Interface,
  prompt: string,
  defaultValue = true,
): Promise<boolean> {
  const hint = defaultValue ? "[Y/n]" : "[y/N]";

  while (true) {
    const input = await askLine(rl, `${prompt} ${hint}: `);

    if (input === "") return defaultValue;
    if (input === "y" || input === "Y") return true;
    if (input === "n" || input === "N") return false;

    console.log('  ⚠️  "y" か "n" を入力してください。');
  }
}

/**
 * 任意テキスト入力プロンプトを表示する（スキップ可能）
 *
 * Enter のみ（空文字）でスキップ → undefined を返す
 *
 * @param rl     - readline.Interface インスタンス
 * @param prompt - 表示するプロンプト文字列
 * @returns 入力された文字列、またはスキップした場合は undefined
 */
export async function askOptional(
  rl: readline.Interface,
  prompt: string,
): Promise<string | undefined> {
  const input = await askLine(rl, `${prompt} (Enterでスキップ) > `);
  return input === "" ? undefined : input;
}

/**
 * アライコードの入力プロンプトを表示する
 *
 * - 9桁の数字以外は再入力を促す
 *
 * @param rl - readline.Interface インスタンス
 * @returns 入力された9桁のアライコード文字列
 */
export async function askAllyCode(rl: readline.Interface): Promise<string> {
  while (true) {
    const input = await askLine(
      rl,
      "アライコードを入力してください（9桁の数字）> ",
    );

    if (/^\d{9}$/.test(input)) {
      return input;
    }

    console.log("  ⚠️  アライコードは9桁の数字で入力してください。");
  }
}
