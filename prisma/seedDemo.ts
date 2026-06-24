import { PrismaClient, FoodType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calculateMealScore } from "../server/services/scoringAlgorithm";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "Demo1234";
const DEMO_NAME = "小林";

const FOOD_BY_TYPE: Record<FoodType, string[]> = {
  [FoodType.FIBER]: [
    "花椰菜",
    "菠菜",
    "高麗菜",
    "生菜",
    "小黃瓜",
    "番茄",
    "香菇",
    "蘆筍",
    "苦瓜",
    "紅蘿蔔",
  ],
  [FoodType.PROTEIN]: [
    "雞胸肉",
    "豬里肌",
    "鮭魚",
    "雞蛋",
    "豆腐",
    "蝦仁",
    "水煮蛋",
    "鯖魚",
    "豆干",
    "毛豆",
  ],
  [FoodType.COMPLEX_CARB]: [
    "糙米飯",
    "地瓜",
    "燕麥",
    "全麥吐司",
    "五穀飯",
    "南瓜",
    "白飯",
    "玉米",
  ],
  [FoodType.SIMPLE_CARB]: [
    "白吐司",
    "珍珠奶茶",
    "餅乾",
    "蛋糕",
    "含糖飲料",
    "白麵包",
  ],
  [FoodType.OTHER]: [],
};

// 各階段的進食順序模板
const PHASE1_SEQUENCES: FoodType[][] = [
  [FoodType.SIMPLE_CARB],
  [FoodType.SIMPLE_CARB],
  [FoodType.SIMPLE_CARB, FoodType.COMPLEX_CARB],
  [FoodType.COMPLEX_CARB, FoodType.SIMPLE_CARB],
  [FoodType.COMPLEX_CARB],
  [FoodType.SIMPLE_CARB, FoodType.PROTEIN],
];

const PHASE2_SEQUENCES: FoodType[][] = [
  [FoodType.PROTEIN],
  [FoodType.FIBER],
  [FoodType.COMPLEX_CARB, FoodType.PROTEIN],
  [FoodType.FIBER, FoodType.SIMPLE_CARB],
  [FoodType.PROTEIN, FoodType.COMPLEX_CARB],
  [FoodType.COMPLEX_CARB],
  [FoodType.PROTEIN, FoodType.FIBER],
];

const PHASE3_SEQUENCES: FoodType[][] = [
  [FoodType.FIBER, FoodType.PROTEIN],
  [FoodType.FIBER, FoodType.PROTEIN],
  [FoodType.FIBER, FoodType.PROTEIN, FoodType.COMPLEX_CARB],
  [FoodType.FIBER, FoodType.PROTEIN, FoodType.COMPLEX_CARB],
  [FoodType.FIBER, FoodType.COMPLEX_CARB],
  [FoodType.PROTEIN, FoodType.COMPLEX_CARB],
  [FoodType.FIBER, FoodType.PROTEIN, FoodType.SIMPLE_CARB],
];

function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("pick() called with empty array");
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSequenceForPhase(phase: 1 | 2 | 3): FoodType[] {
  const rand = Math.random();
  // 各階段加入少量跨期噪音，讓趨勢更自然
  if (phase === 1) {
    return rand < 0.08 ? pick(PHASE2_SEQUENCES) : pick(PHASE1_SEQUENCES);
  }
  if (phase === 2) {
    if (rand < 0.12) return pick(PHASE1_SEQUENCES);
    if (rand > 0.85) return pick(PHASE3_SEQUENCES);
    return pick(PHASE2_SEQUENCES);
  }
  return rand < 0.08 ? pick(PHASE2_SEQUENCES) : pick(PHASE3_SEQUENCES);
}

function buildFoodItems(sequence: FoodType[]) {
  return sequence.map((type, i) => ({
    label: pick(FOOD_BY_TYPE[type]),
    type,
    sequenceIndex: i,
  }));
}

async function main() {
  console.log("清除舊示範帳號資料...");
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  console.log("建立示範帳號...");
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, name: DEMO_NAME, password: hashedPassword },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const TOTAL_DAYS = 180;
  const PHASE2_START = 120; // 120 天前開始第二階段
  const PHASE3_START = 60; // 60 天前開始第三階段

  let recordCount = 0;

  for (let daysAgo = TOTAL_DAYS; daysAgo >= 1; daysAgo--) {
    const phase: 1 | 2 | 3 =
      daysAgo > PHASE2_START ? 1 : daysAgo > PHASE3_START ? 2 : 3;

    const dayDate = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // 每日餐數：第一階段偶爾只吃 1-2 餐，後期多吃 3 餐
    const mealCount =
      phase === 1
        ? pick([1, 2, 2, 2, 3])
        : phase === 2
          ? pick([2, 2, 3, 3])
          : pick([2, 3, 3, 3]);

    // 早餐 7-8 點、午餐 12-13 點、晚餐 18-19 點
    const mealHours = [7, 12, 18].slice(0, mealCount);

    for (const baseHour of mealHours) {
      const sequence = getSequenceForPhase(phase);
      const scoreResult = calculateMealScore(sequence);

      if (scoreResult.totalScore === null) continue;

      const recordedAt = new Date(
        dayDate.getTime() +
          baseHour * 60 * 60 * 1000 +
          Math.random() * 60 * 60 * 1000,
      );

      await prisma.mealRecord.create({
        data: {
          userId: user.id,
          totalScore: scoreResult.totalScore,
          tips: scoreResult.tips,
          recordedAt,
          foodItems: { create: buildFoodItems(sequence) },
        },
      });

      recordCount++;
    }
  }

  console.log(`\n完成！建立 ${recordCount} 筆餐點紀錄（共 ${TOTAL_DAYS} 天）`);
  console.log(`\n示範帳號：`);
  console.log(`  Email   : ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
