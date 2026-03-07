/**
 * RotE TB チャットアドバイス用プロンプト組み立てモジュール
 *
 * チャット形式対応:
 * - buildSystemPrompt: セッション開始時に1回だけ組み立てるシステムプロンプト
 *   プレイヤー情報・目的・手動JSONデータを全て埋め込む
 * - 会話履歴は呼び出し元（client.ts）が管理する
 *
 * purposeの追加・変更は ROTE_PURPOSE_CONFIG だけを編集すればよい。
 * ラベル・ガイドライン・初回ユーザーメッセージをまとめて一元管理している。
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
  | "guild_rewards";

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
// RotE purpose 一元定義
// -------------------------------------------------------

/**
 * RotE TB の各目的（purpose）に対応する定義オブジェクト。
 *
 * 新しい purpose を追加・変更する場合はここだけ編集すればよい。
 * - label:          選択UIや「今回の目的」セクションに表示する日本語ラベル
 * - guidelines:     システムプロンプトの「アドバイスの方針」に追加する目的固有の指示
 * - initialMessage: セッション開始時にAIへ送る最初のユーザーメッセージ
 */
const ROTE_PURPOSE_CONFIG: Record<
  RotePurpose,
  { label: string; guidelines: string[]; initialMessage: string }
> = {
  platoon: {
    label: "小隊配置（Platoon）の最大化",
    guidelines: [
      "- 今回の目的は**小隊配置（Platoon）の最大化**である",
      "- 小隊に必要なキャラクターを優先して育てることを軸にアドバイスすること",
      "- 小隊充足率を上げることにフォーカスし、それ以外の観点（ミッション強化等）は参考程度に留めること",
    ],
    initialMessage:
      "私のキャラクター育成状況を踏まえて、RotE TBの小隊配置（Platoon）を最大化するための育成アドバイスをしてください。優先的に育てるべきキャラクターのトップ5と、その理由を教えてください。",
  },

  combat_mission: {
    label: "通常戦闘ミッションへの貢献",
    guidelines: [
      "- 今回の目的は**通常戦闘ミッションへの貢献**である",
      "- RotE TBの通常ミッションで使える編成を強化することを軸にアドバイスすること",
      "- ミッション貢献度を上げることにフォーカスし、それ以外の観点（小隊充足等）は参考程度に留めること",
    ],
    initialMessage:
      "私のキャラクター育成状況を踏まえて、RotE TBの通常戦闘ミッションに貢献するための育成アドバイスをしてください。今すぐ使える編成と、今後育てるべきキャラクターを教えてください。",
  },

  special_mission: {
    label: "スペシャルミッションのクリア",
    guidelines: [
      "- 今回の目的は**スペシャルミッションのクリア**である",
      "- スペシャルミッションに必要なキャラクターと必要レリックを満たすことを軸にアドバイスすること",
      "- ミッション解放・クリア条件の達成にフォーカスし、それ以外の観点（小隊充足等）は参考程度に留めること",
    ],
    initialMessage:
      "私のキャラクター育成状況を踏まえて、RotE TBのスペシャルミッションをクリアするための育成アドバイスをしてください。どのミッションが達成可能で、何を育てれば次のミッションが解放されるか教えてください。",
  },

  guild_rewards: {
    label: "ギルド報酬の向上",
    guidelines: [
      "- 今回の目的は**RotE TBでのギルド報酬の向上**である",
      "",
      "## RotE TBの報酬メカニズム（正確に理解すること）",
      "- ギルド報酬は「獲得した星の総数」によって完全に決まる",
      "- 星は各惑星（ゾーン）に設定されたTP閾値を超えることで獲得できる（1惑星につき最大☆3）",
      "- TP閾値は1フェーズで超えられなかった場合、次フェーズでその惑星の続きを戦うことで積み上げられる",
      "  （例: ☆1条件 1B TP、☆2条件 1.5B TPの惑星で P1に700M TPを稼いだ場合、P2に800M TP追加で☆2獲得）",
      "- TPを稼ぐ手段は以下の3つのみである:",
      "  1. 小隊配置（Platoon）: 1小隊を埋めると約10M TP。1小隊は15体のキャラで構成される",
      "  2. 戦闘ミッション（CM）クリア: 1ミッションにつき約250K TP",
      "  3. キャラ配置（Deploy）: 配置したキャラのGP値がそのままTP値になる",
      "- 「個人のGPを上げる」こと自体は目的ではない。GPはキャラ配置時のTP換算にしか使われない",
      "",
      "## スペシャルミッション（SM）について",
      "- SMクリアはTPには直接寄与しないが、Mk2/Mk3ギルドイベントトークンやRevaのかけら等の追加報酬を獲得できる",
      "- SMは特定キャラ・特定レリックレベルが必要な編成縛りがある",
      "",
      "## アドバイスの出し方",
      "- 育成候補キャラについて、以下の3軸でのギルド貢献度を評価し、総合的なおすすめ優先順位を示すこと:",
      "  1. 小隊配置: 何フェーズ・何か所の小隊に必要か（=TP貢献量）",
      "  2. 戦闘ミッション: どのミッションが解放・強化されるか（=TP貢献量）",
      "  3. SM: どのスペシャルミッション報酬が獲得できるようになるか",
      "- 各キャラについて3軸の貢献度を明示した上で、総合的なおすすめ度と優先順位を示すこと",
      "- 「GP向上」「GP上げ」「GPを増やす」などの表現は使わないこと",
    ],
    initialMessage:
      "私のキャラクター育成状況を踏まえて、RotE TBでのギルド報酬を向上させるための育成アドバイスをしてください。小隊配置・戦闘ミッション・スペシャルミッションの3軸でギルドへの貢献度を評価し、優先して育てるべきキャラクターとその理由を教えてください。",
  },
};

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

/**
 * ユニット一覧をプロンプト用テキストに変換する
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
      notReady.push(`  ✗ ${unitId}: 未所持 → Relic${requiredRelic} 必要`);
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
 * 選択されたモード・目的を「今回の目的」セクション用テキストに変換する
 */
function formatSelectionLabel(selection: ModeSelection): string {
  if (selection.mode === "rote") {
    return `Rise of the Empire TB / ${ROTE_PURPOSE_CONFIG[selection.purpose].label}`;
  }
  if (selection.mode === "tw") {
    return "テリトリーウォー（TW）";
  }
  return "グランドアリーナ（GAC）";
}

/**
 * 選択されたpurposeに応じたアドバイス方針ガイドラインを返す
 * rote 以外のモードでは空文字を返す
 */
function formatPurposeGuidelines(selection: ModeSelection): string {
  if (selection.mode !== "rote") return "";
  return ROTE_PURPOSE_CONFIG[selection.purpose].guidelines.join("\n") + "\n";
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
  const selectionLabel = formatSelectionLabel(selection);
  const purposeGuidelines = formatPurposeGuidelines(selection);

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

${selectionLabel}
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

${purposeGuidelines}
- 上記のキャラクター実データを必ず参照してアドバイスすること
- 「今のプレイヤーの状況」に基づいた具体的なキャラクター名を挙げること
- RotE TB要件データが空の場合でも、育成状況から推測してアドバイスすること
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
    return ROTE_PURPOSE_CONFIG[selection.purpose].initialMessage;
  }
  if (selection.mode === "tw") {
    return "私のキャラクター育成状況を踏まえて、テリトリーウォー（TW）での貢献を最大化するための育成アドバイスをしてください。";
  }
  return "私のキャラクター育成状況を踏まえて、グランドアリーナ（GAC）での戦績を上げるための育成アドバイスをしてください。";
}

/**
 * RotE TB の全 purpose のラベルを返す
 * CLI・Discordの選択肢UI構築に使用する
 */
export const ROTE_PURPOSE_LABELS: Record<RotePurpose, string> = Object.fromEntries(
  Object.entries(ROTE_PURPOSE_CONFIG).map(([key, config]) => [key, config.label]),
) as Record<RotePurpose, string>;
