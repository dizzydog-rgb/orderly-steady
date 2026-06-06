import { z } from 'zod';

export const CreateMealSchema = z.object({
  email: z.string().email('email 格式不正確'),
  foods: z
    .array(z.string().min(1, '食物名稱不得為空').max(100, '食物名稱過長'))
    .min(1, '至少填寫 1 項食物')
    .max(3, '最多填寫 3 項食物'),
});

export type CreateMealInput = z.infer<typeof CreateMealSchema>;
