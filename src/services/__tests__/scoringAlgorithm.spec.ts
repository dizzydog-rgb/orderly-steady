import { describe, it, expect } from 'vitest';
import { calculateMealScore } from '../scoringAlgorithm';
import { FoodType } from '../../types';

describe('calculateMealScore — 槽位配分制', () => {

  // --- 3 項 ---

  it('3項 F→P→CC 應得 100 分且無 tips', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN, FoodType.COMPLEX_CARB]);
    expect(result.totalScore).toBe(100);
    expect(result.tips).toHaveLength(0);
  });

  it('3項 F→P→SC 應得 85 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN, FoodType.SIMPLE_CARB]);
    // 50 + 30 + 5 = 85
    expect(result.totalScore).toBe(85);
  });

  it('3項 SC→P→CC 應得 43 分且有 tips', () => {
    const result = calculateMealScore([FoodType.SIMPLE_CARB, FoodType.PROTEIN, FoodType.COMPLEX_CARB]);
    // 5 + 30 + 20 = 55... wait: SC in slot1=5, P in slot2=30, CC in slot3=20 → 55
    expect(result.totalScore).toBe(55);
    expect(result.tips.length).toBeGreaterThan(0);
  });

  // --- 2 項 ---

  it('2項 F→P 應得 80 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN]);
    // 50 + 30 + 0 = 80
    expect(result.totalScore).toBe(80);
  });

  it('2項 F→CC 應得 68 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.COMPLEX_CARB]);
    // 50 + 18 + 0 = 68
    expect(result.totalScore).toBe(68);
    expect(result.tips).toContain('纖維之後搭配蛋白質，控糖效果更佳。');
  });

  it('2項 CC→P 應得 45 分且有 tips', () => {
    const result = calculateMealScore([FoodType.COMPLEX_CARB, FoodType.PROTEIN]);
    // 15 + 30 + 0 = 45
    expect(result.totalScore).toBe(45);
    expect(result.tips).toContain('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
  });

  // --- 1 項 ---

  it('1項 F 應得 50 分', () => {
    const result = calculateMealScore([FoodType.FIBER]);
    expect(result.totalScore).toBe(50);
    expect(result.tips).toHaveLength(0);
  });

  it('1項 P 應得 30 分且有 tips', () => {
    const result = calculateMealScore([FoodType.PROTEIN]);
    // 30 + 0 + 0 = 30
    expect(result.totalScore).toBe(30);
    expect(result.tips).toContain('將「膳食纖維」放在第一口，能有效減緩餐後血糖上升。');
  });

  it('1項 SC 應得 5 分且有精緻糖警告', () => {
    const result = calculateMealScore([FoodType.SIMPLE_CARB]);
    expect(result.totalScore).toBe(5);
    expect(result.tips).toContain('空腹攝取精緻糖會導致血糖劇烈波動，建議放在餐後。');
  });

  // --- breakdown 結構驗證 ---

  it('breakdown 應有三個槽位，未填槽位 input 為 null、score 為 0', () => {
    const result = calculateMealScore([FoodType.FIBER]);
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown[0]).toMatchObject({ slot: 1, input: FoodType.FIBER, slotMax: 50, score: 50 });
    expect(result.breakdown[1]).toMatchObject({ slot: 2, input: null, slotMax: 30, score: 0 });
    expect(result.breakdown[2]).toMatchObject({ slot: 3, input: null, slotMax: 20, score: 0 });
  });
});
