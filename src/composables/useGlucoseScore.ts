import { computed, ref } from 'vue';
import { FoodType } from '../types';
import type { IMealItem, IScoringResult } from '../types';
import { calculateMealScore } from '../services/scoringAlgorithm';

const EMPTY_RESULT: IScoringResult = { totalScore: 0, scorableCount: 0, inversions: 0, maxInversions: 0, breakdown: [], tips: [] };

type MealSequence = [FoodType] | [FoodType, FoodType] | [FoodType, FoodType, FoodType];

export function useGlucoseScore() {
  // 固定三槽，最多存三個項目
  const mealSequence = ref<IMealItem[]>([]);

  const scoreResult = computed((): IScoringResult => {
    const types = mealSequence.value.map(item => item.type);
    if (types.length === 0) return EMPTY_RESULT;
    return calculateMealScore(types as MealSequence);
  });

  const scoreColor = computed(() => {
    const score = scoreResult.value.totalScore;
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#facc15';
    return '#f87171';
  });

  // 依序填入下一個空槽（最多三項）
  function addFood(type: FoodType, label: string) {
    if (mealSequence.value.length >= 3) return;
    mealSequence.value.push({
      id: Math.random().toString(36).substring(7),
      type,
      label,
    });
  }

  function clearSequence() {
    mealSequence.value = [];
  }

  return {
    mealSequence,
    scoreResult,
    scoreColor,
    addFood,
    clearSequence,
  };
}
