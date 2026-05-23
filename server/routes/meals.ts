import { Router } from "express";
import { FoodType } from "@prisma/client";
import prisma from "../db";
import { getFoodType } from "../services/ai";
import { calculateMealScore } from "../services/scoringAlgorithm";
import type { IScoringResult } from "../services/scoringAlgorithm";

const router = Router();

// POST /api/meals
router.post("/", async (req, res) => {
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

    // 3. 計算得分（槽位配分制）
    const typesSequence = foodItemsData.map((item) => item.type) as
      | [FoodType]
      | [FoodType, FoodType]
      | [FoodType, FoodType, FoodType];

    const scoreResult: IScoringResult = calculateMealScore(typesSequence);

    // 4. 寫入資料庫
    const record = await prisma.mealRecord.create({
      data: {
        userId: user.id,
        totalScore: scoreResult.totalScore,
        tips: scoreResult.tips,
        foodItems: {
          create: foodItemsData.map((item, index) => {
            const slot = scoreResult.breakdown[index];
            return {
              type: item.type,
              label: item.label,
              sequenceIndex: item.sequenceIndex,
              baseScore: slot.slotMax,
              modifier: 1.0,
              finalScore: slot.score,
            };
          }),
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
