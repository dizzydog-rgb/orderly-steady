import { FoodType } from '../types';
import type { IScoringResult } from '../types';

const BASE_SCORES: Record<FoodType, number> = {
  [FoodType.FIBER]: 40,
  [FoodType.PROTEIN]: 30,
  [FoodType.COMPLEX_CARB]: 20,
  [FoodType.SIMPLE_CARB]: 10,
};

export function calculateMealScore(sequence: FoodType[]): IScoringResult {
  let totalScore = 0;
  const breakdown: IScoringResult['breakdown'] = [];

  const hasFiberEarly = sequence.slice(0, 2).includes(FoodType.FIBER);

  sequence.forEach((type, index) => {
    const baseScore = BASE_SCORES[type];
    let modifier = 1.0;

    // 1. 早熟扣分 (Premature Penalty): 碳水出現在纖維之前
    if ((type === FoodType.COMPLEX_CARB || type === FoodType.SIMPLE_CARB)) {
        const fiberIndex = sequence.indexOf(FoodType.FIBER);
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
  };
}
