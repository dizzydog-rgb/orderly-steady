import { describe, it, expect } from 'vitest';
import { calculateMealScore } from '../scoringAlgorithm';
import { FoodType } from '../../types';

describe('calculateMealScore — 逆序對計分制', () => {

  // --- 完美順序（0 逆序對）---

  it('FIBER→PROTEIN→COMPLEX_CARB 應得 100 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN, FoodType.COMPLEX_CARB]);
    expect(result.totalScore).toBe(100);
    expect(result.inversions).toBe(0);
    expect(result.tips).toContain('進食順序完美！持續保持這樣的飲食習慣。');
  });

  it('FIBER→PROTEIN→SIMPLE_CARB 應得 100 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN, FoodType.SIMPLE_CARB]);
    expect(result.totalScore).toBe(100);
    expect(result.inversions).toBe(0);
  });

  // --- 完全逆序（最高逆序對）---

  it('SIMPLE_CARB→PROTEIN→FIBER（完全逆序）應得 0 分', () => {
    const result = calculateMealScore([FoodType.SIMPLE_CARB, FoodType.PROTEIN, FoodType.FIBER]);
    expect(result.totalScore).toBe(0);
    expect(result.inversions).toBe(3);
    expect(result.maxInversions).toBe(3);
  });

  // --- 部分逆序 ---

  it('PROTEIN→FIBER→SIMPLE_CARB（1 逆序對 / max 3）應得 67 分', () => {
    const result = calculateMealScore([FoodType.PROTEIN, FoodType.FIBER, FoodType.SIMPLE_CARB]);
    expect(result.inversions).toBe(1);
    expect(result.maxInversions).toBe(3);
    expect(result.totalScore).toBe(67);
  });

  it('2 項 PROTEIN→FIBER（1 逆序對 / max 1）應得 0 分', () => {
    const result = calculateMealScore([FoodType.PROTEIN, FoodType.FIBER]);
    expect(result.inversions).toBe(1);
    expect(result.maxInversions).toBe(1);
    expect(result.totalScore).toBe(0);
  });

  it('2 項 FIBER→PROTEIN（0 逆序對）應得 100 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN]);
    expect(result.totalScore).toBe(100);
    expect(result.inversions).toBe(0);
  });

  // --- OTHER 排除 ---

  it('FIBER→OTHER→SIMPLE_CARB（OTHER 排除，0 逆序對）應得 100 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.OTHER, FoodType.SIMPLE_CARB]);
    expect(result.scorableCount).toBe(2);
    expect(result.inversions).toBe(0);
    expect(result.totalScore).toBe(100);
    expect(result.breakdown[1].isOther).toBe(true);
  });

  it('OTHER→PROTEIN→FIBER（OTHER 排除，1 逆序對 / max 1）應得 0 分', () => {
    const result = calculateMealScore([FoodType.OTHER, FoodType.PROTEIN, FoodType.FIBER]);
    expect(result.scorableCount).toBe(2);
    expect(result.inversions).toBe(1);
    expect(result.totalScore).toBe(0);
  });

  // --- 邊界：scorable ≤ 1 → 100 分 ---

  it('全 OTHER（scorable=0）應得 100 分', () => {
    const result = calculateMealScore([FoodType.OTHER, FoodType.OTHER, FoodType.OTHER]);
    expect(result.totalScore).toBe(100);
    expect(result.scorableCount).toBe(0);
  });

  it('1 項 FIBER（scorable=1）應得 100 分', () => {
    const result = calculateMealScore([FoodType.FIBER]);
    expect(result.totalScore).toBe(100);
    expect(result.scorableCount).toBe(1);
  });

  it('1 項 SIMPLE_CARB 有精緻糖 tip', () => {
    const result = calculateMealScore([FoodType.SIMPLE_CARB]);
    expect(result.totalScore).toBe(100);
    expect(result.tips).toContain('空腹攝取精緻糖會導致血糖劇烈波動，建議放在餐後。');
  });

  // --- breakdown 結構 ---

  it('breakdown 長度等於輸入食物數量，isOther 正確', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.OTHER, FoodType.SIMPLE_CARB]);
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown[0]).toMatchObject({ slot: 1, isOther: false, type: FoodType.FIBER });
    expect(result.breakdown[1]).toMatchObject({ slot: 2, isOther: true,  type: FoodType.OTHER });
    expect(result.breakdown[2]).toMatchObject({ slot: 3, isOther: false, type: FoodType.SIMPLE_CARB });
  });

  // --- Tips ---

  it('FIBER 開頭且 scorable >= 2 不觸發纖維 tip', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.SIMPLE_CARB]);
    expect(result.tips).not.toContain('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
  });

  it('非 FIBER 開頭觸發纖維 tip', () => {
    const result = calculateMealScore([FoodType.PROTEIN, FoodType.FIBER]);
    expect(result.tips).toContain('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
  });

  it('FIBER→COMPLEX_CARB 觸發「搭配蛋白質」tip', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.COMPLEX_CARB]);
    expect(result.tips).toContain('纖維之後搭配蛋白質，控糖效果更佳。');
  });
});
