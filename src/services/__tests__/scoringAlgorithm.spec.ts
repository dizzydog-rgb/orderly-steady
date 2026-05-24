import { describe, it, expect } from 'vitest';
import { calculateMealScore } from '../scoringAlgorithm';
import { FoodType } from '../../types';

describe('calculateMealScore — all_pair 加權矩陣', () => {

  // ── m >= 2 ────────────────────────────────────────────────────

  describe('m >= 2 (pair 計算)', () => {
    it('FIBER→PROTEIN→SIMPLE_CARB 應 ≥ 85', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN, FoodType.SIMPLE_CARB]);
      expect(result.totalScore).toBeGreaterThanOrEqual(85);
      expect(result.scorableCount).toBe(3);
    });

    it('SIMPLE_CARB→PROTEIN→FIBER（完全差序）應 ≤ 15', () => {
      const result = calculateMealScore([FoodType.SIMPLE_CARB, FoodType.PROTEIN, FoodType.FIBER]);
      expect(result.totalScore).toBeLessThanOrEqual(15);
      expect(result.totalScore).not.toBeNull();
    });

    it('PROTEIN→SIMPLE_CARB（scorable=2，SC index=1，扣 10）', () => {
      const result = calculateMealScore([FoodType.PROTEIN, FoodType.SIMPLE_CARB]);
      expect(result.totalScore).toBe(80);
      expect(result.scorableCount).toBe(2);
    });

    it('FIBER→PROTEIN（scorable=2，無懲罰）應得 100', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN]);
      expect(result.totalScore).toBe(100);
    });

    it('SC 首位（scorable=2）扣 30 分', () => {
      // SC→P: weightedRaw=1*1.5=1.5, max=15 → round(10) = 10, -30 → max(0,0) = 0
      const result = calculateMealScore([FoodType.SIMPLE_CARB, FoodType.PROTEIN]);
      expect(result.totalScore).toBe(0);
    });

    it('OTHER 排除後計算（FIBER→OTHER→SIMPLE_CARB，scorable=[F,SC]）', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.OTHER, FoodType.SIMPLE_CARB]);
      expect(result.scorableCount).toBe(2);
      // SC at scorable[1] → PENALTY[1]=10; (F,SC) d=1 w=1.5 score=8 → 12; max=15 → 80-10=70
      expect(result.totalScore).toBe(70);
      expect(result.breakdown[1].isOther).toBe(true);
    });

    it('完美順序觸發 perfect tip（FIBER→PROTEIN，penalty=0）', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN]);
      expect(result.tips).toContain('進食順序完美！持續保持這樣的飲食習慣。');
    });

    it('FIBER→PROTEIN→SIMPLE_CARB（penalty=0）觸發 perfect tip', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN, FoodType.SIMPLE_CARB]);
      expect(result.tips).toContain('進食順序完美！持續保持這樣的飲食習慣。');
    });

    it('非 FIBER 開頭觸發纖維 tip', () => {
      const result = calculateMealScore([FoodType.PROTEIN, FoodType.FIBER]);
      expect(result.tips).toContain('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
    });

    it('SIMPLE_CARB 首位觸發空腹精緻糖 tip', () => {
      const result = calculateMealScore([FoodType.SIMPLE_CARB, FoodType.PROTEIN]);
      expect(result.tips).toContain('空腹攝取精緻糖會導致血糖劇烈波動，建議放在餐後。');
    });

    it('FIBER→COMPLEX_CARB 觸發「搭配蛋白質」tip', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.COMPLEX_CARB]);
      expect(result.tips).toContain('纖維之後搭配蛋白質，控糖效果更佳。');
    });

    it('FIBER 開頭且第二位為 PROTEIN 不觸發「搭配蛋白質」tip', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN]);
      expect(result.tips).not.toContain('纖維之後搭配蛋白質，控糖效果更佳。');
    });
  });

  // ── m === 1 ────────────────────────────────────────────────────

  describe('m === 1 (單一可評分食物)', () => {
    it('SIMPLE_CARB → totalScore=20，tips 2 條', () => {
      const result = calculateMealScore([FoodType.SIMPLE_CARB]);
      expect(result.totalScore).toBe(20);
      expect(result.scorableCount).toBe(1);
      expect(result.tips).toHaveLength(2);
      expect(result.tips[0]).toContain('精緻糖');
      expect(result.tips[1]).toContain('膳食纖維');
      expect(result.tips[1]).toContain('蛋白質');
      expect(result.tips[1]).toContain('複合碳水');
    });

    it('FIBER → totalScore=60，tips 1 條，缺少蛋白質、複合碳水、精緻糖', () => {
      const result = calculateMealScore([FoodType.FIBER]);
      expect(result.totalScore).toBe(60);
      expect(result.scorableCount).toBe(1);
      expect(result.tips).toHaveLength(1);
      expect(result.tips[0]).toContain('蛋白質');
      expect(result.tips[0]).toContain('複合碳水');
      expect(result.tips[0]).toContain('精緻糖');
    });

    it('PROTEIN → totalScore=60，tips 含膳食纖維', () => {
      const result = calculateMealScore([FoodType.PROTEIN]);
      expect(result.totalScore).toBe(60);
      expect(result.tips[0]).toContain('膳食纖維');
    });

    it('COMPLEX_CARB → totalScore=60，tips 含膳食纖維', () => {
      const result = calculateMealScore([FoodType.COMPLEX_CARB]);
      expect(result.totalScore).toBe(60);
      expect(result.tips[0]).toContain('膳食纖維');
    });

    it('m=1 均衡建議缺少類型依 FIBER→PROTEIN→COMPLEX_CARB→SIMPLE_CARB 順序', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.OTHER]);
      // scorable=[F], m=1 → 均衡建議應為「蛋白質、複合碳水、精緻糖」
      expect(result.tips[0]).toBe('請加入蛋白質、複合碳水、精緻糖以達到飲食均衡。');
    });
  });

  // ── m === 0 ────────────────────────────────────────────────────

  describe('m === 0 (無可評分食物)', () => {
    it('全 OTHER → totalScore=null', () => {
      const result = calculateMealScore([FoodType.OTHER, FoodType.OTHER, FoodType.OTHER]);
      expect(result.totalScore).toBeNull();
      expect(result.scorableCount).toBe(0);
      expect(result.tips).toContain('未記錄任何可評分食物');
    });
  });

  // ── breakdown ─────────────────────────────────────────────────

  describe('breakdown 結構', () => {
    it('length 等於輸入食物數量', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.OTHER, FoodType.SIMPLE_CARB]);
      expect(result.breakdown).toHaveLength(3);
    });

    it('isOther 正確標記', () => {
      const result = calculateMealScore([FoodType.FIBER, FoodType.OTHER, FoodType.SIMPLE_CARB]);
      expect(result.breakdown[0]).toMatchObject({ slot: 1, isOther: false, type: FoodType.FIBER });
      expect(result.breakdown[1]).toMatchObject({ slot: 2, isOther: true,  type: FoodType.OTHER });
      expect(result.breakdown[2]).toMatchObject({ slot: 3, isOther: false, type: FoodType.SIMPLE_CARB });
    });
  });
});
