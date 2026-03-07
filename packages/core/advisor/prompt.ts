/**
 * RotE TB チャットアドバイス用プロンプト組み立てモジュール
 *
 * チャット形式対応:
 * - buildSystemPrompt: セッション開始時に1回だけ組み立てるシステムプロンプト
 *   プレイヤー情報・目的・手動JSONデータを全て埋め込む
 * - 会話履歴は呼び出し元（client.ts）が管理する
 */

import type { FormattedUnit, FormattedPlayer } from "../comlink/types.ts";
import type { UnitRequirement } from "../data/types.ts";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

/** 対応しているゲームモード */
export type GameMode = "rote" | "tw" | "gac";

/** RotE TBの目的 */
export type RotePurpose =
  | "platoon"
  | "combat_mission"
  | "special_mission"
  | "gp";

/** 選択されたモードと目的 */
export type ModeSelection =
  | { mode: "rote"; purpose: RotePurpose }
  | { mode: "tw" }
  | { mode: "gac" };

/**
 * システムプロンプト生成に必要な入力データ
 */
export interface ChatSystemPromptInput {
  /** プレイヤー名 */
  playerName: string;
  /** アライコード */
  allyCode: number;
  /** プレイヤーレベル */
  level: number;
  /** ギルド名 */
  guildName: string;
  /** 総GP */
  galacticPower: number;
  /** キャラクターGP */
  characterGalacticPower: number;
  /** 艦隊GP */
  shipGalacticPower: number;
  /** R5以上キャラ一覧（AIへのアドバイス用・レリック降順） */
  topUnits: FormattedUnit[];
  /** 全キャラのMap（要件達成状況チェック用・R5未満も含む） */
  allUnitsMap: FormattedPlayer["units"];
  /** 選択されたモードと目的 */
  selection: ModeSelection;
  /** ユーザーが入力した自由記述の補足（任意） */
  userNote?: string;
  /** RotE TBの要件一覧（手動JSONから。空でも可） */
  roteRequirements?: UnitRequirement[];
  /** RotE TBの最大レリック要件Map（ユニットID → 最大必要レリックレベル） */
  maxRelicRequirementsMap?: Map<string, number>;
}

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

/**
 * GP上位ユニット一覧をプロンプト用テキストに変換する
 */
function formatTopUnits(topUnits: FormattedUnit[]): string {
  if (topUnits.length === 0) {
    return "  （データなし）";
  }

  return topUnits
    .map((u, i) => {
      const status =
        u.gearLevel < 13
          ? `Gear${u.gearLevel} / ${u.stars}★`
          : `Relic${u.relicLevel} / ${u.stars}★`;
      return `  ${i + 1}. ${u.id}: ${status}`;
    })
    .join("\n");
}

/**
 * RotE TB 要件達成状況テキストを生成する
 */
function formatRoteStatus(
  allUnitsMap: FormattedPlayer["units"],
  maxRelicRequirementsMap: Map<string, number>,
): string {
  if (maxRelicRequirementsMap.size === 0) {
    return "  （RotE TB要件データ未入力。R5以上キャラを元にアドバイスしてください）";
  }

  const lines: string[] = [];

  const notReady: string[] = [];
  const ready: string[] = [];

  for (const [unitId, requiredRelic] of maxRelicRequirementsMap) {
    // isAny フラグ相当のエントリ（"Any"・"Any Jedi" 等）はスキップ
    // これらは特定キャラではなく属性縛りの任意枠のため達成状況は表示しない
    if (unitId === "Any" || unitId.startsWith("Any ")) {
      continue;
    }

    const unit = allUnitsMap.get(unitId);
    const currentRelic = unit?.relicLevel ?? 0;
    const currentGear = unit?.gearLevel ?? 0;

    // 未所持
    if (unit === undefined) {
      notReady.push(
        `  ✗ ${unitId}: 未所持 → Relic${requiredRelic} 必要`,
      );
      continue;
    }

    // Gear13未満はレリック解放不可
    if (currentGear < 13) {
      notReady.push(
        `  ✗ ${unitId}: Gear${currentGear}（Gear13未到達のためレリック不可）→ Relic${requiredRelic} 必要`,
      );
      continue;
    }

    // Gear13以上：レリックレベルで判定
    const currentStatus = `Relic${currentRelic}`;

    if (currentRelic >= requiredRelic) {
      ready.push(`  ✓ ${unitId}: ${currentStatus} (要件: Relic${requiredRelic})`);
    } else {
      const deficit = requiredRelic - currentRelic;
      notReady.push(
        `  ✗ ${unitId}: ${currentStatus} → Relic${requiredRelic} 必要（あと${deficit}不足）`,
      );
    }
  }

  if (notReady.length > 0) {
    lines.push("【要件未達】");
    lines.push(...notReady);
  }
  if (ready.length > 0) {
    lines.push("");
    lines.push("【要件達成済み】");
    lines.push(...ready);
  }

  return lines.join("\n");
}

/**
 * 選択されたモード・目的を日本語テキストに変換する
 */
function formatSelection(selection: ModeSelection): string {
  if (selection.mode === "rote") {
    const purposeLabels: Record<RotePurpose, string> = {
      platoon: "小隊配置（Platoon）の最大化",
      combat_mission: "通常戦闘ミッションへの貢献",
      special_mission: "スペシャルミッションのクリア",
      gp: "GP上げ全般",
    };
    return `Rise of the Empire TB / ${purposeLabels[selection.purpose]}`;
  }
  if (selection.mode === "tw") {
    return "テリトリーウォー（TW）";
  }
  return "グランドアリーナ（GAC）";
}

// -------------------------------------------------------
// システムプロンプト組み立て
// -------------------------------------------------------

/**
 * チャットセッション全体で使うシステムプロンプトを組み立てる
 *
 * セッション開始時に1回だけ呼ばれる。
 * プレイヤー情報・目的・手動JSONデータを全て埋め込み、
 * 以降の会話の土台となる文脈を提供する。
 *
 * @param input - システムプロンプト生成に必要なデータ
 * @returns Claude APIに渡すシステムプロンプト文字列
 */
export function buildSystemPrompt(input: ChatSystemPromptInput): string {
  const {
    playerName,
    allyCode,
    level,
    guildName,
    galacticPower,
    characterGalacticPower,
    shipGalacticPower,
    topUnits,
    allUnitsMap,
    selection,
    userNote,
    roteRequirements,
    maxRelicRequirementsMap,
  } = input;

  const topUnitsText = formatTopUnits(topUnits);
  const selectionText = formatSelection(selection);

  const roteStatusText =
    selection.mode === "rote" && maxRelicRequirementsMap != null
      ? formatRoteStatus(allUnitsMap, maxRelicRequirementsMap)
      : null;

  const requirementsCount = roteRequirements?.length ?? 0;

  return `
あなたはStar Wars: Galaxy of Heroes（SWGoH）の育成アドバイザーです。
以下のプレイヤー情報を元に、具体的で実践的な育成アドバイスを提供してください。
プレイヤーとの対話形式で、質問には丁寧かつ簡潔に日本語で答えてください。

## プレイヤー情報

- プレイヤー名: ${playerName}
- アライコード: ${allyCode}
- プレイヤーレベル: ${level}
- ギルド: ${guildName || "（ギルド未加入）"}
- 総GP: ${galacticPower.toLocaleString("ja-JP")}（キャラ: ${characterGalacticPower.toLocaleString("ja-JP")} / 艦隊: ${shipGalacticPower.toLocaleString("ja-JP")}）

## 今回の目的

${selectionText}
${userNote ? `\n補足: ${userNote}` : ""}

## R5以上キャラクター一覧（レリック降順・全${topUnits.length}件）

${topUnitsText}

${
  roteStatusText != null
    ? `## RotE TB 要件達成状況（要件データ件数: ${requirementsCount}件）

${roteStatusText}
`
    : ""
}
## アドバイスの方針

- 上記のGP上位キャラクターの実データを必ず参照してアドバイスすること
- 「今のプレイヤーの状況」に基づいた具体的なキャラクター名を挙げること
- RotE TB要件データが空の場合でも、GP上位キャラから推測してアドバイスすること
- 育成の優先順位を明確にすること（なぜそのキャラが優先かも説明する）
- 短期（次のTBまで）・中期（2〜3ヶ月）の目標を分けて考えること
- プレイヤーからの追加質問には、前の会話の文脈を踏まえて答えること
`.trim();
}

/**
 * チャットセッションの最初のユーザーメッセージ（初回アドバイス依頼）を返す
 *
 * @param selection - 選択されたモードと目的
 * @returns 最初のユーザーメッセージ文字列
 */
export function buildInitialUserMessage(selection: ModeSelection): string {
  if (selection.mode === "rote") {
    const purposeMessages: Record<RotePurpose, string> = {
      platoon:
        "私のキャラクター育成状況を踏まえて、RotE TBの小隊配置（Platoon）を最大化するための育成アドバイスをしてください。優先的に育てるべきキャラクターのトップ5と、その理由を教えてください。",
      combat_mission:
        "私のキャラクター育成状況を踏まえて、RotE TBの通常戦闘ミッションに貢献するための育成アドバイスをしてください。今すぐ使える編成と、今後育てるべきキャラクターを教えてください。",
      special_mission:
        "私のキャラクター育成状況を踏まえて、RotE TBのスペシャルミッションをクリアするための育成アドバイスをしてください。どのミッションが達成可能で、何を育てれば次のミッションが解放されるか教えてください。",
      gp: "私のキャラクター育成状況を踏まえて、GPを効率よく上げるための育成アドバイスをしてください。RotE TBへの貢献も考慮しながら、優先的に育てるべきキャラクターを教えてください。",
    };
    return purposeMessages[selection.purpose];
  }
  if (selection.mode === "tw") {
    return "私のキャラクター育成状況を踏まえて、テリトリーウォー（TW）での貢献を最大化するための育成アドバイスをしてください。";
  }
  return "私のキャラクター育成状況を踏まえて、グランドアリーナ（GAC）での戦績を上げるための育成アドバイスをしてください。";
}
