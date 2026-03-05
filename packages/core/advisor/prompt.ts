/**
 * RotE TB アドバイス用プロンプト組み立てモジュール
 */

import type { FormattedPlayer, FormattedUnit } from "../comlink/types.ts";
import type { UnitRequirement } from "../data/types.ts";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

export interface RoteTBPromptInput {
  player: FormattedPlayer;
  requirements: UnitRequirement[];
  /** 最大レリック要件Map（ユニットID → 最大必要レリックレベル） */
  maxRelicRequirementsMap: Map<string, number>;
}

interface UnitStatus {
  id: string;
  note: string;
  requiredRelicLevel: number;
  currentRelicLevel: number;
  currentGearLevel: number;
  stars: number;
  /** 要件を満たしているか */
  meetsRequirement: boolean;
  /** レリック不足分（0なら不足なし） */
  relicDeficit: number;
}

// -------------------------------------------------------
// ユニット状況の算出
// -------------------------------------------------------

/**
 * 各ユニットの現状と要件のギャップを算出する
 */
function buildUnitStatusList(
  requirements: UnitRequirement[],
  maxRelicRequirementsMap: Map<string, number>,
  playerUnits: Map<string, FormattedUnit>,
): UnitStatus[] {
  // ユニットIDごとに重複排除（最大レリック要件Mapのキーを使う）
  const seen = new Set<string>();
  const statusList: UnitStatus[] = [];

  for (const [unitId, requiredRelicLevel] of maxRelicRequirementsMap) {
    if (seen.has(unitId)) continue;
    seen.add(unitId);

    // noteはrequirementsから取得（最初に見つかったものを使用）
    const reqEntry = requirements.find((r) => r.id === unitId);
    const note = reqEntry?.note ?? unitId;

    const playerUnit = playerUnits.get(unitId);
    const currentRelicLevel = playerUnit?.relicLevel ?? 0;
    const currentGearLevel = playerUnit?.gearLevel ?? 0;
    const stars = playerUnit?.stars ?? 0;

    const relicDeficit = Math.max(0, requiredRelicLevel - currentRelicLevel);
    const meetsRequirement = relicDeficit === 0;

    statusList.push({
      id: unitId,
      note,
      requiredRelicLevel,
      currentRelicLevel,
      currentGearLevel,
      stars,
      meetsRequirement,
      relicDeficit,
    });
  }

  // 不足しているユニットを先頭に、不足が大きい順に並べる
  statusList.sort((a, b) => {
    if (a.meetsRequirement !== b.meetsRequirement) {
      return a.meetsRequirement ? 1 : -1;
    }
    return b.relicDeficit - a.relicDeficit;
  });

  return statusList;
}

// -------------------------------------------------------
// プロンプト組み立て
// -------------------------------------------------------

/**
 * ユニット状況テーブルを文字列に変換する
 */
function formatUnitStatusTable(statusList: UnitStatus[]): string {
  const lines: string[] = [];

  const notReady = statusList.filter((u) => !u.meetsRequirement);
  const ready = statusList.filter((u) => u.meetsRequirement);

  if (notReady.length > 0) {
    lines.push("【要件未達のキャラクター】");
    for (const u of notReady) {
      const gearOrRelic =
        u.currentGearLevel < 13
          ? `Gear${u.currentGearLevel}`
          : `Relic${u.currentRelicLevel}`;
      lines.push(
        `  - ${u.note} (ID: ${u.id}): 現在 ${gearOrRelic} / 必要 Relic${u.requiredRelicLevel} → ${u.relicDeficit > 0 ? `あと${u.relicDeficit}レリック不足` : "Gearアップが必要"}`,
      );
    }
  }

  if (ready.length > 0) {
    lines.push("");
    lines.push("【要件達成済みのキャラクター】");
    for (const u of ready) {
      const gearOrRelic =
        u.currentGearLevel < 13
          ? `Gear${u.currentGearLevel}`
          : `Relic${u.currentRelicLevel}`;
      lines.push(
        `  - ${u.note} (ID: ${u.id}): 現在 ${gearOrRelic} / 必要 Relic${u.requiredRelicLevel} ✓`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * RotE TB アドバイス用のプロンプトを組み立てる
 *
 * @param input - プロンプト生成に必要なデータ
 * @returns Claude APIに渡すプロンプト文字列（userメッセージ部分）
 */
export function buildRoteTBPrompt(input: RoteTBPromptInput): string {
  const { player, requirements, maxRelicRequirementsMap } = input;

  const statusList = buildUnitStatusList(
    requirements,
    maxRelicRequirementsMap,
    player.units,
  );

  const notReadyCount = statusList.filter((u) => !u.meetsRequirement).length;
  const readyCount = statusList.filter((u) => u.meetsRequirement).length;
  const totalCount = statusList.length;

  const unitStatusText = formatUnitStatusTable(statusList);

  return `
あなたはStar Wars: Galaxy of Heroes（SWGoH）の育成アドバイザーです。
プレイヤーのキャラクター育成状況を分析し、Rise of the Empire（RotE）テリトリーバトル（TB）の攻略に向けた具体的な育成アドバイスを提供してください。

## プレイヤー情報

- プレイヤー名: ${player.name}
- アライコード: ${player.allyCode}
- プレイヤーレベル: ${player.level}
- 総GP: ${player.galacticPower.toLocaleString("ja-JP")}（キャラ: ${player.characterGalacticPower.toLocaleString("ja-JP")} / 艦隊: ${player.shipGalacticPower.toLocaleString("ja-JP")}）
- ギルド: ${player.guildName || "（ギルド未加入）"}

## RotE TB 要件達成状況のサマリー

- 対象キャラクター総数: ${totalCount}
- 要件達成済み: ${readyCount} キャラ
- 要件未達: ${notReadyCount} キャラ

## キャラクター別の詳細状況

${unitStatusText}

## 依頼内容

上記の情報を元に、以下の点についてアドバイスをお願いします。

1. **優先的に育てるべきキャラクターのトップ5**
   - 理由（どのフェーズ・どのミッションに影響するか）も含めてください

2. **現状でRotE TBに貢献できる点**
   - 要件達成済みのキャラを活かせる場面

3. **中期的な育成方針**
   - 今後2〜3ヶ月で目指すべき目標

回答は日本語でお願いします。具体的で実践的なアドバイスを期待しています。
`.trim();
}

/**
 * システムプロンプトを返す
 */
export function buildSystemPrompt(): string {
  return `あなたはStar Wars: Galaxy of Heroes（SWGoH）の専門家です。
ゲームのメカニクス、キャラクターの役割、テリトリーバトル（TB）の仕組みに精通しています。
プレイヤーのデータを元に、具体的で実践的な育成アドバイスを提供することが得意です。
回答は日本語で、箇条書きや見出しを使って読みやすく整理してください。`;
}
