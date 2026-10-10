import { z } from 'zod';

// 註冊與變更密碼共用同一份密碼規則，避免兩處驗證標準分歧
const passwordField = z
  .string()
  .min(8, '密碼需要至少 8 個字元')
  .max(100, '密碼不得超過 100 字');

export const RegisterSchema = z.object({
  email: z.string().email('email 格式不正確'),
  password: passwordField,
  name: z.string().max(50, '名稱不得超過 50 字').optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('email 格式不正確'),
  password: z.string().min(1, '密碼為必填'),
});

export const UpdateNicknameSchema = z.object({
  name: z.string().trim().min(1, '名稱不得為空').max(50, '名稱不得超過 50 字'),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: passwordField,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '新密碼不得與目前密碼相同',
    path: ['newPassword'],
  });

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateNicknameInput = z.infer<typeof UpdateNicknameSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
