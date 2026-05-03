import { PrismaClient } from "@prisma/client";

// 為避免開發環境(例如使用 tsx)熱重載時不斷建立新的 PrismaClient 導致連線數爆滿
// 我們將 PrismaClient 實例綁定到 globalThis 上 (單例模式 Singleton)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
