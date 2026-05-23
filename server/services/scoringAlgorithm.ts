import { FoodType } from "@prisma/client";

export interface IFoodBreakdown {
  slot: number;
  label: string | null;
  type: FoodType | null;
  isOther: boolean;
}

export interface IScoringResult {
  totalScore: number;
  scorableCount: number;
  inversions: number;
  maxInversions: number;
  breakdown: IFoodBreakdown[];
  tips: string[];
}

// 理想進食優先級：數字越小越優先
const PRIORITY: Partial<Record<FoodType, number>> = {
  [FoodType.FIBER]: 0,
  [FoodType.PROTEIN]: 1,
  [FoodType.COMPLEX_CARB]: 2,
  [FoodType.SIMPLE_CARB]: 3,
};

function buildTips(scorable: FoodType[], inversions: number): string[] {
  const tips: string[] = [];
  if (scorable.length === 0) return tips;

  if (scorable[0] !== FoodType.FIBER) {
    tips.push('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
  }
  if (scorable[0] === FoodType.SIMPLE_CARB) {
    tips.push('空腹攝取精緻糖會導致血糖劇烈波動，建議放在餐後。');
  }
  if (scorable.length >= 2 && scorable[0] === FoodType.FIBER && scorable[1] !== FoodType.PROTEIN) {
    tips.push('纖維之後搭配蛋白質，控糖效果更佳。');
  }
  if (inversions === 0 && scorable.length >= 2) {
    tips.push('進食順序完美！持續保持這樣的飲食習慣。');
  }

  return tips;
}

export function calculateMealScore(sequence: FoodType[]): IScoringResult {
  const scorable = sequence.filter(t => PRIORITY[t] !== undefined);
  const n = scorable.length;

  const breakdown: IFoodBreakdown[] = sequence.map((type, i) => ({
    slot: i + 1,
    label: null,
    type,
    isOther: PRIORITY[type] === undefined,
  }));

  if (n <= 1) {
    return {
      totalScore: 100,
      scorableCount: n,
      inversions: 0,
      maxInversions: 0,
      breakdown,
      tips: buildTips(scorable, 0),
    };
  }

  let inversions = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (PRIORITY[scorable[i]]! > PRIORITY[scorable[j]]!) inversions++;
    }
  }

  const maxInversions = n * (n - 1) / 2;
  const totalScore = Math.round((1 - inversions / maxInversions) * 100);

  return {
    totalScore,
    scorableCount: n,
    inversions,
    maxInversions,
    breakdown,
    tips: buildTips(scorable, inversions),
  };
}
