import { z } from 'zod';
import { FoodType } from '@prisma/client';
import { MAX_FOOD_LABEL_LENGTH, normalizeLabel } from '../services/foodLabel';

// 名稱會先正規化才作為查詢鍵；NFKC 可能改變長度（全形空白變空字串、合字被展開），
// 因此正規化後的長度也要檢查，避免寫入 DB 時超出欄位長度
const foodLabel = z
  .string()
  .min(1, '食物名稱不得為空')
  .max(MAX_FOOD_LABEL_LENGTH, '食物名稱過長')
  .refine((label) => normalizeLabel(label).length >= 1, '食物名稱不得為空')
  .refine((label) => normalizeLabel(label).length <= MAX_FOOD_LABEL_LENGTH, '食物名稱過長');

export const CreateMealSchema = z.object({
  email: z.string().email('email 格式不正確'),
  foods: z
    .array(foodLabel)
    .min(1, '至少填寫 1 項食物')
    .max(3, '最多填寫 3 項食物'),
});

export const UpdateFoodTypeSchema = z.object({
  type: z.enum(FoodType, '食物類別不正確'),
});

export const UpsertFoodOverrideSchema = z.object({
  label: foodLabel,
  type: z.enum(FoodType, '食物類別不正確'),
});

export type CreateMealInput = z.infer<typeof CreateMealSchema>;
export type UpdateFoodTypeInput = z.infer<typeof UpdateFoodTypeSchema>;
export type UpsertFoodOverrideInput = z.infer<typeof UpsertFoodOverrideSchema>;
