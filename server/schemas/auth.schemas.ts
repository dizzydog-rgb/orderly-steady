import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('email 格式不正確'),
  password: z.string().min(8, '密碼至少 8 個字元'),
  name: z.string().max(50, '名稱不得超過 50 字').optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('email 格式不正確'),
  password: z.string().min(1, '密碼為必填'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
