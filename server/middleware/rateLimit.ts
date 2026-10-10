import rateLimit from "express-rate-limit";

// E2E 測試需要反覆重跑，IP 計數會在幾輪內用完額度；僅開發環境可用環境變數旁路
export const isRateLimitDisabled = () =>
  process.env.NODE_ENV !== "production" && process.env.RATE_LIMIT_DISABLED === "true";

// 修正食物分類（PATCH /api/meals/:recordId/items/:sequenceIndex、PUT /api/food-overrides）共用額度
export const foodCorrectionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "請求過於頻繁，請稍後再試" },
  skip: isRateLimitDisabled,
});
