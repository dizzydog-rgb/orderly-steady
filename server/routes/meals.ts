import { Router } from "express";
import prisma from "../db";
import { getFoodType } from "../services/ai";
import { calculateMealScore } from "../services/scoringAlgorithm";

const router = Router();

// POST /api/meals
router.post("/", async (req, res) => {
  try {
    const { userId, foods } = req.body;

    if (!userId || !Array.isArray(foods) || foods.length === 0) {
      return res.status(400).json({ error: "Missing userId or foods array" });
    }

    // 1. Get food types for each label (caching handled in service)
    const foodItemsData = await Promise.all(
      foods.map(async (label, index) => {
        const type = await getFoodType(label);
        return { label, type, sequenceIndex: index };
      })
    );

    // 2. Calculate scores
    const typesSequence = foodItemsData.map((item) => item.type);
    const scoreResult = calculateMealScore(typesSequence);

    // 3. Save to database
    // Note: In a real app, we'd ensure the User exists first.
    // For this prototype, we assume userId is valid or handle it.
    const record = await prisma.mealRecord.create({
      data: {
        userId,
        totalScore: scoreResult.totalScore,
        tips: scoreResult.tips as any, // tips is string[]
        foodItems: {
          create: foodItemsData.map((item, index) => {
            const analysis = scoreResult.breakdown[index];
            return {
              type: item.type,
              label: item.label,
              sequenceIndex: item.sequenceIndex,
              baseScore: analysis.baseScore,
              modifier: analysis.modifier,
              finalScore: analysis.finalItemScore,
            };
          }),
        },
      },
      include: {
        foodItems: true,
      },
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

export default router;
