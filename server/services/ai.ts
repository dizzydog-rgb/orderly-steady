import Anthropic from '@anthropic-ai/sdk';
import { FoodType } from "@prisma/client";
import prisma from "../db";

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

async function claudeClassify(label: string): Promise<FoodType> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16,
    system: `你是食物分類助手。根據食物名稱判斷其最主要營養類別，只能回答以下五個英文代號之一：
FIBER（蔬菜、菇類、海藻等高膳食纖維）
PROTEIN（肉、蛋、魚、豆腐、乳製品等高蛋白）
COMPLEX_CARB（糙米、燕麥、全麥、地瓜、玉米等複合碳水）
SIMPLE_CARB（白飯、白麵、麵包、水果、甜點、含糖飲料等精緻糖）
OTHER（酪梨、堅果、醬料、複合料理等無法明確歸類的食物）`,
    messages: [{ role: 'user', content: label }],
  });

  const text = (message.content[0] as { type: 'text'; text: string }).text.trim();
  return VALID_TYPES[text] ?? FoodType.OTHER;
}

export async function getFoodType(label: string): Promise<FoodType> {
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
