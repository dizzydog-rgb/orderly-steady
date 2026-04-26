import { describe, it, expect } from 'vitest';
import { calculateMealScore } from '../scoringAlgorithm';
import { FoodType } from '../../types';

describe('scoringAlgorithm', () => {
  it('案例 A (優良): F -> P -> CC 應得約 94 分', () => {
    const sequence = [FoodType.FIBER, FoodType.PROTEIN, FoodType.COMPLEX_CARB];
    const result = calculateMealScore(sequence);
    // 40(1.0) + 30(1.0) + 20(1.2) = 40 + 30 + 24 = 94
    expect(result.totalScore).toBe(94);
  });

  it('案例 C (不佳): CC -> F -> P 應得約 80 分', () => {
    const sequence = [FoodType.COMPLEX_CARB, FoodType.FIBER, FoodType.PROTEIN];
    const result = calculateMealScore(sequence);
    // 20(0.5) + 40(1.0) + 30(1.0) = 10 + 40 + 30 = 80
    expect(result.totalScore).toBe(80);
  });

  it('空序列應得 0 分', () => {
    const result = calculateMealScore([]);
    expect(result.totalScore).toBe(0);
  });
});
