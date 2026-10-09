import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const E2E_TEST_EMAIL = 'e2e.settings@orderly-steady.test';
export const E2E_TEST_PASSWORD = 'E2eTest1234!';
export const E2E_TEST_NAME = 'E2E 測試員';

const prisma = new PrismaClient();

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未設定，無法重置 E2E 測試帳號');
  const { hostname } = new URL(url);
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error('E2E 測試只能對本機資料庫執行，目前 DATABASE_URL host 為 ' + hostname);
  }
}

export async function resetE2ETestUser(): Promise<void> {
  assertLocalDatabase();
  await prisma.user.deleteMany({ where: { email: E2E_TEST_EMAIL } });
  const password = await bcrypt.hash(E2E_TEST_PASSWORD, 10);
  await prisma.user.create({
    data: { email: E2E_TEST_EMAIL, name: E2E_TEST_NAME, password },
  });
}

export async function disconnectE2EPrisma(): Promise<void> {
  await prisma.$disconnect();
}
