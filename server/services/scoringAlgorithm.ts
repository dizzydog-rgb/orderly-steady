import { FoodType } from "@prisma/client";

export interface IScoringResult {
  totalScore: number;
  breakdown: {
    baseScore: number;
    modifier: number;
    finalItemScore: number;
    type: FoodType;
  }[];
  tips: string[];
}

const BASE_SCORES: Record<FoodType, number> = {
  [FoodType.FIBER]: 40,
  [FoodType.PROTEIN]: 30,
  [FoodType.COMPLEX_CARB]: 20,
  [FoodType.SIMPLE_CARB]: 10,
};

export function calculateMealScore(sequence: FoodType[]): IScoringResult {
  let totalScore = 0;
  const breakdown: IScoringResult["breakdown"] = [];
  const tips: string[] = [];

  if (sequence.length === 0) {
    return { totalScore: 0, breakdown: [], tips: [] };
  }

  const hasFiberEarly = sequence.slice(0, 2).includes(FoodType.FIBER);
  const fiberIndex = sequence.indexOf(FoodType.FIBER);
  const carbIndices = sequence
    .map((t, i) => (t === FoodType.COMPLEX_CARB || t === FoodType.SIMPLE_CARB ? i : -1))
    .filter((i) => i !== -1);

  // Tips Logic
  if (fiberIndex === -1) {
    tips.push("建議加入膳食纖維（如蔬菜），能有效減緩血糖上升。");
  } else if (fiberIndex > 0) {
    tips.push("嘗試將「膳食纖維」放在第一順位，控糖效果更佳。");
  }

  if (carbIndices.length > 0) {
    const firstCarbIndex = carbIndices[0];
    if (fiberIndex === -1 || fiberIndex > firstCarbIndex) {
      tips.push("在攝取碳水化合物之前，先吃點蔬菜建立緩衝吧！");
    }
  }

  if (sequence[0] === FoodType.SIMPLE_CARB) {
    tips.push("空腹攝取精緻糖會導致血糖劇烈波動，建議放在餐後。");
  }

  sequence.forEach((type, index) => {
    const baseScore = BASE_SCORES[type];
    let modifier = 1.0;

    // 1. 早熟扣分 (Premature Penalty): 碳水出現在纖維之前
    if (type === FoodType.COMPLEX_CARB || type === FoodType.SIMPLE_CARB) {
      if (fiberIndex === -1 || fiberIndex > index) {
        modifier = 0.5;
      } else if (hasFiberEarly && index >= 2) {
        // 2. 緩衝加成 (Buffer Bonus): 前兩項有纖維且目前是第三項以後
        modifier = 1.2;
      }
    }

    const finalItemScore = Math.round(baseScore * modifier);
    totalScore += finalItemScore;

    breakdown.push({
      baseScore,
      modifier,
      finalItemScore,
      type,
    });
  });

  return {
    totalScore,
    breakdown,
    tips,
  };
}
