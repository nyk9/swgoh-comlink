/**
 * GL イベント参加条件をプレイヤーデータと照合する関数
 *
 * プレイヤーの所有ユニットと GL イベントの要件を比較して、
 * 各 Tier をクリアできるか、または何が足りないかを判定する
 */

import type {
  FormattedPlayer,
  GLEventData,
  GLEventTierData,
} from "./types.ts";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

/**
 * ユニット要件の判定結果
 */
export interface UnitRequirementStatus {
  /** ユニット ID */
  unitId: string;
  /** ユニットが所有されているか */
  owned: boolean;
  /** 現在のスター数（所有していない場合は0） */
  currentStars: number;
  /** 必要なスター数 */
  requiredStars: number;
  /** 現在のレリックレベル（所有していない場合は0） */
  currentRelicLevel: number;
  /** 必要なレリックレベル */
  requiredRelicLevel: number;
  /** この要件を満たしているか */
  isMet: boolean;
}

/**
 * カテゴリタグ要件の判定結果
 */
export interface CategoryRequirementStatus {
  /** カテゴリ ID */
  categoryId: string;
  /** このカテゴリに該当するユニット一覧 */
  unitsInCategory: Array<{
    unitId: string;
    stars: number;
    relicLevel: number;
    meetsRequirement: boolean;
  }>;
  /** 要件を満たすユニット数 */
  adequateCount: number;
  /** 必要なユニット数 */
  requiredCount: number;
  /** この要件を満たしているか */
  isMet: boolean;
}

/**
 * Tier 全体の判定結果
 */
export interface TierRequirementStatus {
  /** Tier ID */
  tierId: string;
  /** Tier 番号 */
  tierNumber: number;
  /** 必須キャラ要件の判定結果 */
  mandatoryUnits: UnitRequirementStatus[];
  /** カテゴリタグ要件の判定結果 */
  categoryRequirements: CategoryRequirementStatus[];
  /** この Tier をクリアできるか */
  canClear: boolean;
  /** 不足しているユニット・要件の説明 */
  missingItems: string[];
}

/**
 * GL イベント全体の判定結果
 */
export interface GLEventRequirementStatus {
  /** GL キャラクター ID */
  characterId: string;
  /** GL イベント node ID */
  nodeId: string;
  /** 各 Tier の判定結果 */
  tiers: TierRequirementStatus[];
  /** クリア可能な最後の Tier 番号（0 の場合は1つもクリア不可） */
  lastClearableTierNumber: number;
  /** 全 Tier をクリアできるか */
  canCompletely: boolean;
}

// -------------------------------------------------------
// 内部ヘルパー関数
// -------------------------------------------------------

/**
 * プレイヤーが指定したカテゴリタグを持つユニットを取得する
 * ※ 注意: 現在のコード実装では categoryId からユニット ID への逆引きができないため、
 *    ここでは簡易実装（categoryId に selftag_ で始まるものは、
 *    そのユニット ID をそのまま使用するという仮定）
 */
function findUnitsInCategory(
  categoryId: string,
  player: FormattedPlayer,
): string[] {
  // 現状の実装では selftag_XXXXX の形式から XXXXX を抽出
  // 本来は Comlink の unit データから categoryId → unitId の逆引きが必要
  if (categoryId.startsWith("selftag_")) {
    const unitId = categoryId.substring("selftag_".length).toUpperCase();
    if (player.units.has(unitId)) {
      return [unitId];
    }
  }

  // TODO: Comlink から取得した categoryId → unitId の対応表を使う
  // const unitsByCategory = await getCategoryUnitMapping();
  // return unitsByCategory[categoryId] ?? [];

  return [];
}

/**
 * ユニット要件を判定する
 */
function checkUnitRequirement(
  unitId: string,
  requiredStars: number,
  requiredRelicLevel: number,
  player: FormattedPlayer,
): UnitRequirementStatus {
  const unit = player.units.get(unitId);

  if (!unit) {
    return {
      unitId,
      owned: false,
      currentStars: 0,
      requiredStars,
      currentRelicLevel: 0,
      requiredRelicLevel,
      isMet: false,
    };
  }

  const isMet =
    unit.stars >= requiredStars &&
    unit.relicLevel >= requiredRelicLevel;

  return {
    unitId,
    owned: true,
    currentStars: unit.stars,
    requiredStars,
    currentRelicLevel: unit.relicLevel,
    requiredRelicLevel,
    isMet,
  };
}

/**
 * カテゴリタグ要件を判定する
 */
function checkCategoryRequirement(
  categoryId: string,
  requiredCount: number,
  minimumStars: number,
  minimumRelicLevel: number,
  player: FormattedPlayer,
): CategoryRequirementStatus {
  const unitsInCategory = findUnitsInCategory(categoryId, player);

  const unitsWithStatus = unitsInCategory.map((unitId) => {
    const unit = player.units.get(unitId);
    if (!unit) {
      return {
        unitId,
        stars: 0,
        relicLevel: 0,
        meetsRequirement: false,
      };
    }

    const meetsRequirement =
      unit.stars >= minimumStars && unit.relicLevel >= minimumRelicLevel;

    return {
      unitId,
      stars: unit.stars,
      relicLevel: unit.relicLevel,
      meetsRequirement,
    };
  });

  const adequateCount = unitsWithStatus.filter((u) => u.meetsRequirement)
    .length;
  const isMet = adequateCount >= requiredCount;

  return {
    categoryId,
    unitsInCategory: unitsWithStatus,
    adequateCount,
    requiredCount,
    isMet,
  };
}

// -------------------------------------------------------
// 公開 API
// -------------------------------------------------------

/**
 * プレイヤーが GL イベントの特定の Tier をクリアできるか判定する
 */
export function checkTierRequirements(
  tier: GLEventTierData,
  player: FormattedPlayer,
): TierRequirementStatus {
  const mandatoryUnits = tier.mandatoryUnitIds.map((unitId) =>
    checkUnitRequirement(
      unitId,
      tier.minimumStars,
      tier.minimumRelicLevel,
      player,
    ),
  );

  const categoryRequirements = tier.categoryIds.map((categoryId) =>
    checkCategoryRequirement(
      categoryId,
      1, // 各カテゴリ単位で1体必要（TODO: 実装詳細に応じて調整）
      tier.minimumStars,
      tier.minimumRelicLevel,
      player,
    ),
  );

  const mandatoryMet = mandatoryUnits.every((u) => u.isMet);
  const categoryMet = categoryRequirements.every((c) => c.isMet);
  const canClear = mandatoryMet && categoryMet;

  const missingItems: string[] = [];

  for (const unit of mandatoryUnits) {
    if (!unit.isMet) {
      if (!unit.owned) {
        missingItems.push(`${unit.unitId} を獲得する必要があります`);
      } else {
        const starsGap = unit.requiredStars - unit.currentStars;
        const relicGap = unit.requiredRelicLevel - unit.currentRelicLevel;
        if (starsGap > 0) {
          missingItems.push(
            `${unit.unitId} をあと ${starsGap} つ星上げる`,
          );
        }
        if (relicGap > 0) {
          missingItems.push(
            `${unit.unitId} をあと R${relicGap} レリック上げる`,
          );
        }
      }
    }
  }

  for (const category of categoryRequirements) {
    if (!category.isMet) {
      const gap = category.requiredCount - category.adequateCount;
      missingItems.push(
        `${category.categoryId} タグを持つユニットをあと ${gap} 体育成する`,
      );
    }
  }

  return {
    tierId: tier.tierId,
    tierNumber: tier.tierNumber,
    mandatoryUnits,
    categoryRequirements,
    canClear,
    missingItems,
  };
}

/**
 * プレイヤーが GL イベント全体をどこまでクリアできるか判定する
 */
export function checkGLEventRequirements(
  glEvent: GLEventData,
  player: FormattedPlayer,
): GLEventRequirementStatus {
  const tiers = glEvent.tiers.map((tier) =>
    checkTierRequirements(tier, player),
  );

  // クリア可能な最後の Tier を探す
  let lastClearableTierNumber = 0;
  for (const tierStatus of tiers) {
    if (tierStatus.canClear) {
      lastClearableTierNumber = tierStatus.tierNumber;
    } else {
      break; // 最初に失敗したら以降はクリア不可と仮定
    }
  }

  const canCompletely = tiers.length > 0 && tiers[tiers.length - 1]!.canClear;

  return {
    characterId: glEvent.characterId,
    nodeId: glEvent.nodeId,
    tiers,
    lastClearableTierNumber,
    canCompletely,
  };
}

/**
 * GL イベント判定結果をテキストで表示用に整形する
 */
export function formatGLEventStatus(
  status: GLEventRequirementStatus,
): string {
  const lines: string[] = [];

  lines.push(
    `\n【${status.characterId} GL イベント 進捗】`,
  );
  lines.push(`Node ID: ${status.nodeId}`);
  lines.push("");

  for (const tier of status.tiers) {
    const icon = tier.canClear ? "✅" : "❌";
    lines.push(`${icon} ${tier.tierId}`);

    if (!tier.canClear && tier.missingItems && tier.missingItems.length > 0) {
      for (const item of tier.missingItems) {
        lines.push(`   └─ ${item}`);
      }
    }
  }

  lines.push("");
  if (status.canCompletely) {
    lines.push("🎉 全 Tier をクリア可能です！");
  } else {
    lines.push(`📊 クリア可能: Tier ${status.lastClearableTierNumber} まで`);
  }

  return lines.join("\n");
}
