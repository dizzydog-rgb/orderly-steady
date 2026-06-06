import { Router } from "express";
import prisma from "../db";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../services/authService";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { RegisterSchema, LoginSchema } from "../schemas/auth.schemas";

const router = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

// POST /api/auth/register
router.post("/register", validate(RegisterSchema), async (req, res) => {
  const { email, password, name } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "此 Email 已被註冊" });
  }

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name: name ?? null, password: hashed },
    select: { id: true, email: true, name: true },
  });

  return res.status(201).json({ message: "註冊成功", user });
});

// POST /api/auth/login
router.post("/login", validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    return res.status(401).json({ error: "帳號或密碼錯誤" });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "帳號或密碼錯誤" });
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken 為必填" });
  }

  try {
    const { userId } = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: "無效或已過期的 Refresh Token" });
    }

    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ error: "無效或已過期的 Refresh Token" });
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { refreshToken: null },
  });
  res.clearCookie("refreshToken", { path: "/api/auth" });
  return res.json({ message: "已登出" });
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return res.status(404).json({ error: "使用者不存在" });
  }

  return res.json({ user });
});

export default router;
