import { FoodType } from "@prisma/client";

export interface IFoodBreakdown {
  slot: number;
  label: string | null;
  type: FoodType | null;
  isOther: boolean;
}

export interface IScoringResult {
  totalScore: number | null;
  scorableCount: number;
  breakdown: IFoodBreakdown[];
  tips: string[];
}

const SCORE_MATRIX: Record<string, Record<string, number>> = {
  FIBER:        { FIBER: 5, PROTEIN: 10, COMPLEX_CARB: 10, SIMPLE_CARB: 8 },
  PROTEIN:      { FIBER: 8, PROTEIN:  5, COMPLEX_CARB: 10, SIMPLE_CARB: 8 },
  COMPLEX_CARB: { FIBER: 5, PROTEIN:  5, COMPLEX_CARB:  5, SIMPLE_CARB: 3 },
  SIMPLE_CARB:  { FIBER: 6, PROTEIN:  6, COMPLEX_CARB:  4, SIMPLE_CARB: 0 },
};

const WEIGHT: Record<number, number> = { 1: 1.5, 2: 1.0 };
const SIMPLE_CARB_PENALTY: Record<number, number> = { 0: 10, 1: 10 };

const PRIORITY: Partial<Record<FoodType, number>> = {
  [FoodType.FIBER]: 0,
  [FoodType.PROTEIN]: 1,
  [FoodType.COMPLEX_CARB]: 2,
  [FoodType.SIMPLE_CARB]: 3,
};

const PRIORITY_ORDER: FoodType[] = [FoodType.FIBER, FoodType.PROTEIN, FoodType.COMPLEX_CARB, FoodType.SIMPLE_CARB];

const TYPE_LABELS: Record<string, string> = {
  [FoodType.FIBER]: '膳食纖維',
  [FoodType.PROTEIN]: '蛋白質',
  [FoodType.COMPLEX_CARB]: '複合碳水',
  [FoodType.SIMPLE_CARB]: '精緻糖',
};

function buildTips(scorable: FoodType[], penalty: number): string[] {
  const tips: string[] = [];

  if (scorable[0] !== FoodType.FIBER) {
    tips.push('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
  }
  if (scorable[0] === FoodType.SIMPLE_CARB) {
    tips.push('空腹攝取精緻糖會導致血糖劇烈波動，建議放在餐後。');
  }
  if (scorable.length >= 2 && scorable[0] === FoodType.FIBER && scorable[1] !== FoodType.PROTEIN) {
    tips.push('纖維之後搭配蛋白質，控糖效果更佳。');
  }
  if (penalty === 0 && scorable.length >= 2) {
    tips.push('進食順序完美！持續保持這樣的飲食習慣。');
  }

  return tips;
}

export function calculateMealScore(sequence: FoodType[]): IScoringResult {
  const scorable = sequence.filter(t => PRIORITY[t] !== undefined);
  const m = scorable.length;

  const breakdown: IFoodBreakdown[] = sequence.map((type, i) => ({
    slot: i + 1,
    label: null,
    type,
    isOther: PRIORITY[type] === undefined,
  }));

  if (m === 0) {
    return {
      totalScore: null,
      scorableCount: 0,
      breakdown,
      tips: ['未記錄任何可評分食物'],
    };
  }

  if (m === 1) {
    const singleType = scorable[0];
    const missing = PRIORITY_ORDER.filter(t => t !== singleType && t !== FoodType.SIMPLE_CARB);
    const missingText = missing.map(t => TYPE_LABELS[t]).join('、');

    if (singleType === FoodType.SIMPLE_CARB) {
      return {
        totalScore: 20,
        scorableCount: 1,
        breakdown,
        tips: [
          '此餐以精緻糖為主，血糖波動風險高。',
          `請加入${missingText}以達到飲食均衡。`,
        ],
      };
    }
    if (singleType === FoodType.COMPLEX_CARB) {
      return {
        totalScore: 40,
        scorableCount: 1,
        breakdown,
        tips: [`請加入${missingText}以達到飲食均衡。`],
      };
    }
    return {
      totalScore: 60,
      scorableCount: 1,
      breakdown,
      tips: [`請加入${missingText}以達到飲食均衡。`],
    };
  }

  // m >= 2: all_pair weighted calculation
  let weightedRaw = 0;
  let maxWeightedRaw = 0;

  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      const distance = j - i;
      const weight = WEIGHT[distance] ?? 1.0;
      weightedRaw += SCORE_MATRIX[scorable[i]][scorable[j]] * weight;
      maxWeightedRaw += 10 * weight;
    }
  }

  let totalScore = Math.round((weightedRaw / maxWeightedRaw) * 100);

  let penalty = 0;
  for (let i = 0; i < m; i++) {
    if (scorable[i] === FoodType.SIMPLE_CARB) {
      penalty = Math.max(penalty, SIMPLE_CARB_PENALTY[i] ?? 0);
    }
  }
  totalScore = Math.max(0, totalScore - penalty);

  return {
    totalScore,
    scorableCount: m,
    breakdown,
    tips: buildTips(scorable, penalty),
  };
}
