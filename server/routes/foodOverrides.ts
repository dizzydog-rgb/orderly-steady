import { Router } from "express";
import { upsertFoodOverride } from "../services/ai";
import { authMiddleware } from "../middleware/authMiddleware";
import { foodCorrectionRateLimit } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { UpsertFoodOverrideSchema } from "../schemas/meals.schemas";

const router = Router();

// PUT /api/food-overrides — 新增或更新目前使用者對某食物的個人分類
// 用於當餐全為 OTHER、沒有紀錄可 PATCH 的情況：前端存完覆寫後重送 POST /api/meals
router.put(
  "/",
  authMiddleware,
  foodCorrectionRateLimit,
  validate(UpsertFoodOverrideSchema),
  async (req, res) => {
    const { label, type } = req.body;
    const override = await upsertFoodOverride(req.user!.userId, label, type);
    return res.json({ override: { label: override.label, type: override.type } });
  },
);

export default router;
