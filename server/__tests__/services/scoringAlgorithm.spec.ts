// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { FoodType } from '@prisma/client';
import { calculateMealScore } from '../../services/scoringAlgorithm';

const { FIBER, PROTEIN, COMPLEX_CARB, SIMPLE_CARB, OTHER } = FoodType;

describe('calculateMealScore — backend', () => {
  describe('m = 0 (全 OTHER)', () => {
    it('returns totalScore: null', () => {
      const result = calculateMealScore([OTHER]);
      expect(result.totalScore).toBeNull();
      expect(result.scorableCount).toBe(0);
    });
  });

  describe('m = 1 (單一可評分食物)', () => {
    it('SIMPLE_CARB → totalScore: 20', () => {
      const result = calculateMealScore([SIMPLE_CARB]);
      expect(result.totalScore).toBe(20);
      expect(result.scorableCount).toBe(1);
    });

    it('COMPLEX_CARB → totalScore: 40', () => {
      expect(calculateMealScore([COMPLEX_CARB]).totalScore).toBe(40);
    });

    it('FIBER → totalScore: 60', () => {
      expect(calculateMealScore([FIBER]).totalScore).toBe(60);
    });

    it('PROTEIN → totalScore: 60', () => {
      expect(calculateMealScore([PROTEIN]).totalScore).toBe(60);
    });
  });

  describe('m >= 2 (pair 加權計算)', () => {
    it('[FIBER, PROTEIN] → totalScore: 100（無懲罰，最佳配對）', () => {
      expect(calculateMealScore([FIBER, PROTEIN]).totalScore).toBe(100);
    });

    it('[SIMPLE_CARB, PROTEIN] → totalScore ≤ 50（index=0 懲罰 -10）', () => {
      const result = calculateMealScore([SIMPLE_CARB, PROTEIN]);
      expect(result.totalScore).not.toBeNull();
      expect(result.totalScore!).toBeLessThanOrEqual(50);
    });

    it('[FIBER, PROTEIN, COMPLEX_CARB] → totalScore: 100（理想三食順序）', () => {
      expect(calculateMealScore([FIBER, PROTEIN, COMPLEX_CARB]).totalScore).toBe(100);
    });
  });

  describe('tips 提示文字', () => {
    it('SIMPLE_CARB 首位觸發空腹精緻碳水警告', () => {
      const result = calculateMealScore([SIMPLE_CARB, PROTEIN]);
      expect(result.tips.some(t => t.includes('空腹攝取精緻碳水'))).toBe(true);
    });
  });
});
