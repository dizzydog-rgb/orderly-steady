import Anthropic from '@anthropic-ai/sdk';
import { FoodType } from "@prisma/client";
import type { Prisma, UserFoodOverride } from "@prisma/client";
import prisma from "../db";
import { normalizeLabel } from "./foodLabel";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('[AI] ANTHROPIC_API_KEY is not set in environment variables.');
  }
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const VALID_TYPES: Record<string, FoodType> = {
  FIBER: FoodType.FIBER,
  PROTEIN: FoodType.PROTEIN,
  COMPLEX_CARB: FoodType.COMPLEX_CARB,
  SIMPLE_CARB: FoodType.SIMPLE_CARB,
  OTHER: FoodType.OTHER,
};

const CLASSIFY_SYSTEM_PROMPT = `你是食物分類助手。根據食物名稱判斷其最主要營養類別，只能回答以下五個英文代號之一，不得包含任何其他文字：
FIBER（蔬菜、菇類、海藻、豆芽菜、高麗菜、菠菜、花椰菜等高膳食纖維）
PROTEIN（雞胸、雞腿、雞翅、雞排、鴨肉、豬肉、豬排、牛肉、牛排、羊肉、魚、蝦、蛋、豆腐、起司、鮪魚等高蛋白）
COMPLEX_CARB（糙米、燕麥、全麥麵包、地瓜、玉米、南瓜、全麥義大利麵等複合碳水）
SIMPLE_CARB（白飯、白麵、烏龍麵、拉麵、白吐司、麵包、白粥、水果、蘋果、香蕉、火龍果、西瓜、芒果、甜點、含糖飲料等精緻碳水）
OTHER（酪梨、堅果、橄欖油、醬料、複合料理等無法明確歸類的食物）`;

const TYPE_PATTERN = /FIBER|PROTEIN|COMPLEX_CARB|SIMPLE_CARB|OTHER/;

async function claudeClassify(label: string): Promise<FoodType> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: label }],
  });

  const raw = (message.content[0] as { type: 'text'; text: string }).text;
  console.log(`[AI] Raw response for "${label}": "${raw}"`);
  const match = raw.match(TYPE_PATTERN);
  return match ? (VALID_TYPES[match[0]] ?? FoodType.OTHER) : FoodType.OTHER;
}

// 查詢順序：個人覆寫（僅在帶 userId 時）→ 全域 FoodDictionary 快取 → Claude API
export async function getFoodType(rawLabel: string, userId?: string): Promise<FoodType> {
  const label = normalizeLabel(rawLabel);

  if (userId) {
    const override = await prisma.userFoodOverride.findUnique({
      where: { userId_label: { userId, label } },
    });
    if (override) {
      console.log(`[AI] User override: "${label}" → ${override.type}`);
      return override.type;
    }
  }

  const cached = await prisma.foodDictionary.findUnique({ where: { label } });
  if (cached) {
    console.log(`[AI] Cache hit: "${label}" → ${cached.type}`);
    return cached.type;
  }

  console.log(`[AI] Calling Claude API for: "${label}"`);
  const type = await claudeClassify(label);
  console.log(`[AI] Claude classified: "${label}" → ${type}`);
  await prisma.foodDictionary.create({ data: { label, type } });
  return type;
}

// 寫入個人覆寫；只影響該使用者，全域 FoodDictionary 不受使用者操作改動。
// 傳入 tx 可併入呼叫端的 transaction。
export function upsertFoodOverride(
  userId: string,
  rawLabel: string,
  type: FoodType,
  db: Prisma.TransactionClient = prisma,
): Promise<UserFoodOverride> {
  const label = normalizeLabel(rawLabel);
  return db.userFoodOverride.upsert({
    where: { userId_label: { userId, label } },
    update: { type },
    create: { userId, label, type },
  });
}
