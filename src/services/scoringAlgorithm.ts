import { FoodType } from '../types';
import type { ISlotBreakdown, IScoringResult } from '../types';

const SLOT_MAX = [50, 30, 20] as const;

const SCORE_MATRIX: Record<FoodType, readonly [number, number, number]> = {
  [FoodType.FIBER]:        [50, 10,  5],
  [FoodType.PROTEIN]:      [30, 30,  8],
  [FoodType.COMPLEX_CARB]: [15, 18, 20],
  [FoodType.SIMPLE_CARB]:  [ 5,  5,  5],
};

type MealSequence = [FoodType] | [FoodType, FoodType] | [FoodType, FoodType, FoodType];

export function calculateMealScore(sequence: MealSequence): IScoringResult {
  let totalScore = 0;
  const breakdown: ISlotBreakdown[] = [];
  const tips: string[] = [];

  for (let i = 0; i < 3; i++) {
    const slotIndex = i as 0 | 1 | 2;
    const input = sequence[slotIndex] ?? null;
    const slotMax = SLOT_MAX[slotIndex];
    const score = input !== null ? SCORE_MATRIX[input][slotIndex] : 0;

    totalScore += score;
    breakdown.push({
      slot: (i + 1) as 1 | 2 | 3,
      input,
      slotMax,
      score,
    });
  }

  // Tips
  const [slot1, slot2, slot3] = sequence;

  if (slot1 !== FoodType.FIBER) {
    tips.push('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
  }
  if (slot1 === FoodType.SIMPLE_CARB) {
    tips.push('空腹攝取精緻糖會導致血糖劇烈波動，建議放在餐後。');
  }
  if (sequence.length >= 2 && slot2 !== FoodType.PROTEIN && slot1 === FoodType.FIBER) {
    tips.push('纖維之後搭配蛋白質，控糖效果更佳。');
  }
  if (sequence.length >= 2 && (slot2 === FoodType.SIMPLE_CARB || slot2 === FoodType.COMPLEX_CARB) && slot1 !== FoodType.FIBER) {
    tips.push('在攝取碳水化合物之前，先吃點蔬菜建立緩衝吧！');
  }
  if (sequence.length === 3 && slot3 === FoodType.SIMPLE_CARB) {
    tips.push('以複合碳水取代精緻糖作為收尾，血糖曲線會更平穩。');
  }

  return { totalScore, breakdown, tips };
}
