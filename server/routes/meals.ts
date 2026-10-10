import { Router } from "express";
import { FoodType } from "@prisma/client";
import rateLimit from "express-rate-limit";
import prisma from "../db";
import { getFoodType, upsertFoodOverride } from "../services/ai";
import { calculateMealScore } from "../services/scoringAlgorithm";
import type { IScoringResult } from "../services/scoringAlgorithm";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/authMiddleware";
import { foodCorrectionRateLimit, isRateLimitDisabled } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { CreateMealSchema, UpdateFoodTypeSchema } from "../schemas/meals.schemas";

const router = Router();

const mealsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
  skip: isRateLimitDisabled,
});

interface IClassifiedFood {
  label: string;
  type: FoodType;
}

// 依進食順序計分，並把食物名稱補進 breakdown
function scoreFoods(foods: IClassifiedFood[]): IScoringResult {
  const result = calculateMealScore(foods.map((food) => food.type));
  result.breakdown = result.breakdown.map((b, i) => ({
    ...b,
    label: foods[i]?.label ?? null,
  }));
  return result;
}

// POST /api/meals
router.post("/", mealsRateLimit, optionalAuthMiddleware, validate(CreateMealSchema), async (req, res) => {
  try {
    const { email, foods } = req.body;

    // 1. 取得或建立使用者
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    // 2. AI 分類（含快取）
    // 個人覆寫只套用在 token 屬於此 email 的請求；訪客只憑 email 不會套用任何人的覆寫
    const overrideUserId = req.user?.userId === user.id ? user.id : undefined;
    const foodItemsData = await Promise.all(
      foods.map(async (label: string, index: number) => {
        const type = await getFoodType(label, overrideUserId);
        return { label, type, sequenceIndex: index };
      })
    );

    // 3. 計算得分
    const scoreResult = scoreFoods(foodItemsData);

    // 4. m=0 時跳過 DB 寫入
    if (scoreResult.totalScore === null) {
      return res.status(200).json({ analysis: scoreResult });
    }

    const record = await prisma.mealRecord.create({
      data: {
        userId: user.id,
        totalScore: scoreResult.totalScore,
        tips: scoreResult.tips,
        foodItems: {
          create: foodItemsData.map((item) => ({
            type: item.type,
            label: item.label,
            sequenceIndex: item.sequenceIndex,
          })),
        },
      },
      include: { foodItems: { orderBy: { sequenceIndex: 'asc' } } },
    });

    res.status(201).json({
      message: "Meal record created successfully",
      record,
      analysis: scoreResult,
    });
  } catch (error) {
    console.error("Error creating meal record:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/meals/:recordId/items/:sequenceIndex — 使用者修正單一食物的類別
router.patch(
  "/:recordId/items/:sequenceIndex",
  authMiddleware,
  foodCorrectionRateLimit,
  validate(UpdateFoodTypeSchema),
  async (req, res) => {
    try {
      const recordId = req.params['recordId'] as string;
      const sequenceIndex = Number(req.params['sequenceIndex']);
      const type: FoodType = req.body.type;
      const userId = req.user!.userId;

      const record = await prisma.mealRecord.findUnique({
        where: { id: recordId },
        include: { foodItems: { orderBy: { sequenceIndex: "asc" } } },
      });
      if (!record) {
        return res.status(404).json({ error: "找不到此筆紀錄" });
      }
      if (record.userId !== userId) {
        return res.status(403).json({ error: "無權存取此資源" });
      }

      const target = record.foodItems.find((item) => item.sequenceIndex === sequenceIndex);
      if (!target) {
        return res.status(404).json({ error: "找不到此食物品項" });
      }

      const analysis = scoreFoods(
        record.foodItems.map((item) => (item.id === target.id ? { ...item, type } : item))
      );
      const { totalScore, tips } = analysis;

      // 覆寫與當餐紀錄必須一起成功或一起失敗，否則畫面分數會和下次送出的結果不一致
      const updated = await prisma.$transaction(async (tx) => {
        await upsertFoodOverride(userId, target.label, type, tx);

        // 全部改成 OTHER 後無法計分：比照 POST 的 m=0 不留紀錄（totalScore 欄位不允許 null）
        if (totalScore === null) {
          await tx.mealRecord.delete({ where: { id: record.id } });
          return null;
        }

        await tx.foodItem.update({ where: { id: target.id }, data: { type } });
        return tx.mealRecord.update({
          where: { id: record.id },
          data: { totalScore, tips },
          include: { foodItems: { orderBy: { sequenceIndex: "asc" } } },
        });
      });

      res.json({ record: updated, analysis });
    } catch (error) {
      console.error("Error correcting food type:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// GET /api/meals/:userId
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user!.userId !== userId) {
      return res.status(403).json({ error: "無權存取此資源" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const records = await prisma.mealRecord.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      include: { foodItems: { orderBy: { sequenceIndex: "asc" } } },
    });

    res.json({ records });
  } catch (error) {
    console.error("Error fetching meal records:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
