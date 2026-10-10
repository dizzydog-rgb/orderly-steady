import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { FoodType } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const E2E_TEST_EMAIL = 'e2e.settings@orderly-steady.test';
export const E2E_TEST_PASSWORD = 'E2eTest1234!';
export const E2E_TEST_NAME = 'E2E 測試員';

// 訪客流程（未登入、只填 email）用；POST /api/meals 會自動建立此帳號
export const E2E_GUEST_EMAIL = 'e2e.guest@orderly-steady.test';

// 預先寫入全域 FoodDictionary 的測試用食物：E2E 不必呼叫 Claude API，分類結果也固定
export const E2E_FOODS = {
  fiber: 'e2e測試配菜',
  simpleCarb: 'e2e測試主食',
  other: 'e2e測試醬料',
} as const;

const E2E_FOOD_TYPES: { label: string; type: FoodType }[] = [
  { label: E2E_FOODS.fiber, type: 'FIBER' },
  { label: E2E_FOODS.simpleCarb, type: 'SIMPLE_CARB' },
  { label: E2E_FOODS.other, type: 'OTHER' },
];

const prisma = new PrismaClient();

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未設定，無法重置 E2E 測試帳號');
  const { hostname } = new URL(url);
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error('E2E 測試只能對本機資料庫執行，目前 DATABASE_URL host 為 ' + hostname);
  }
}

// 刪除帳號時，餐點紀錄與個人食物分類覆寫會因 cascade 一併清除
export async function resetE2ETestUser(): Promise<void> {
  assertLocalDatabase();
  await prisma.user.deleteMany({
    where: { email: { in: [E2E_TEST_EMAIL, E2E_GUEST_EMAIL] } },
  });
  const password = await bcrypt.hash(E2E_TEST_PASSWORD, 10);
  await prisma.user.create({
    data: { email: E2E_TEST_EMAIL, name: E2E_TEST_NAME, password },
  });
}

export async function seedE2EFoodDictionary(): Promise<void> {
  assertLocalDatabase();
  for (const { label, type } of E2E_FOOD_TYPES) {
    await prisma.foodDictionary.upsert({
      where: { label },
      update: { type },
      create: { label, type },
    });
  }
}

export async function removeE2EFoodDictionary(): Promise<void> {
  assertLocalDatabase();
  await prisma.foodDictionary.deleteMany({
    where: { label: { in: E2E_FOOD_TYPES.map((food) => food.label) } },
  });
}

export async function disconnectE2EPrisma(): Promise<void> {
  await prisma.$disconnect();
}
