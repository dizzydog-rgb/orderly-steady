import { Router } from "express";
import prisma from "../db";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// DELETE /api/food-dictionary — 清除全部快取
router.delete("/", authMiddleware, async (req, res) => {
  const { count } = await prisma.foodDictionary.deleteMany({});
  return res.json({ message: `已清除 ${count} 筆快取` });
});

// DELETE /api/food-dictionary/:label — 清除單筆快取
router.delete("/:label", authMiddleware, async (req, res) => {
  const { label } = req.params;
  const existing = await prisma.foodDictionary.findUnique({ where: { label } });
  if (!existing) {
    return res.status(404).json({ error: `找不到 "${label}" 的快取記錄` });
  }
  await prisma.foodDictionary.delete({ where: { label } });
  return res.json({ message: `已清除 "${label}" 的快取` });
});

export default router;
