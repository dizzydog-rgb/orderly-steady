import { ref, computed } from 'vue';
import { FoodType } from '../types';
import type { IMealItem } from '../types';
import { calculateMealScore } from '../services/scoringAlgorithm';

export function useGlucoseScore() {
  const mealSequence = ref<IMealItem[]>([]);

  const scoreResult = computed(() => {
    const types = mealSequence.value.map(item => item.type);
    return calculateMealScore(types);
  });

  const scoreColor = computed(() => {
    const score = scoreResult.value.totalScore;
    if (score >= 80) return '#4ade80'; // Green
    if (score >= 60) return '#facc15'; // Yellow
    return '#f87171'; // Red
  });

  function addFood(type: FoodType, label: string) {
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
