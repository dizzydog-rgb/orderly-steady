import { FoodType } from "@prisma/client";
import prisma from "../db";

/**
 * Mock AI function to classify food items.
 * Future implementation will call a real LLM API.
 */
async function mockAIClassify(label: string): Promise<FoodType> {
  const l = label.toLowerCase();
  if (l.includes("菜") || l.includes("纖維") || l.includes("菇") || l.includes("筍")) {
    return FoodType.FIBER;
  }
  if (l.includes("肉") || l.includes("蛋") || l.includes("魚") || l.includes("豆") || l.includes("奶")) {
    return FoodType.PROTEIN;
  }
  if (l.includes("飯") || l.includes("麵") || l.includes("薯") || l.includes("玉米") || l.includes("地瓜")) {
    return FoodType.COMPLEX_CARB;
  }
  if (l.includes("糖") || l.includes("甜") || l.includes("飲") || l.includes("蛋糕") || l.includes("餅乾")) {
    return FoodType.SIMPLE_CARB;
  }
  // Default fallback
  return FoodType.SIMPLE_CARB;
}

export async function getFoodType(label: string): Promise<FoodType> {
  // 1. Check database cache
  const cached = await prisma.foodDictionary.findUnique({
    where: { label },
  });

  if (cached) {
    return cached.type;
  }

  // 2. Ask Mock AI
  const type = await mockAIClassify(label);

  // 3. Save to cache
  await prisma.foodDictionary.create({
    data: {
      label,
      type,
    },
  });

  return type;
}
