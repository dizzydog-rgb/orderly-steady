import { Router } from "express";
import { FoodType } from "@prisma/client";
import rateLimit from "express-rate-limit";
import prisma from "../db";
import { getFoodType } from "../services/ai";
import { calculateMealScore } from "../services/scoringAlgorithm";
import type { IScoringResult } from "../services/scoringAlgorithm";

const router = Router();

const mealsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
});

// POST /api/meals
router.post("/", mealsRateLimit, async (req, res) => {
  try {
    const { email, foods } = req.body;

    if (!email || !Array.isArray(foods) || foods.length === 0 || foods.length > 3) {
      return res.status(400).json({ error: "email 為必填，foods 需為 1–3 項的陣列" });
    }

    // 1. 取得或建立使用者
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    // 2. AI 分類（含快取）
    const foodItemsData = await Promise.all(
      foods.map(async (label: string, index: number) => {
        const type = await getFoodType(label);
        return { label, type, sequenceIndex: index };
      })
    );

    // 3. 計算得分（逆序對計分）
    const typesSequence = foodItemsData.map((item) => item.type);
    const scoreResult: IScoringResult = calculateMealScore(typesSequence);

    // 4. 補充 breakdown 的食物名稱
    scoreResult.breakdown = scoreResult.breakdown.map((b, i) => ({
      ...b,
      label: foods[i] ?? null,
    }));

    // 5. 寫入資料庫（FoodItem 逐項分數已無意義，填入佔位 0）
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
            baseScore: 0,
            modifier: 1.0,
            finalScore: 0,
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

// GET /api/meals/:userId
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

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
