import { Router } from "express";
import rateLimit from "express-rate-limit";
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
import {
  RegisterSchema,
  LoginSchema,
  UpdateNicknameSchema,
  ChangePasswordSchema,
} from "../schemas/auth.schemas";

const router = Router();

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: "/api/auth",
};

// E2E 測試需要反覆重跑，IP 計數會在幾輪內用完額度；僅開發環境可用環境變數旁路
const isRateLimitDisabled = () =>
  process.env.NODE_ENV !== "production" && process.env.RATE_LIMIT_DISABLED === "true";

const nicknameRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "請求過於頻繁，請稍後再試" },
  skip: isRateLimitDisabled,
});

const passwordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "請求過於頻繁，請稍後再試" },
  skip: isRateLimitDisabled,
});

// POST /api/auth/register
router.post("/register", validate(RegisterSchema), async (req, res) => {
  const { email, password, name } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.password !== null) {
      return res.status(409).json({ error: "此 Email 已被註冊" });
    }
    // meals endpoint 自動建立的帳號（password=null）→ 補全密碼完成註冊
    const hashed = await hashPassword(password);
    const user = await prisma.user.update({
      where: { email },
      data: { password: hashed, name: name ?? existing.name ?? null },
      select: { id: true, email: true, name: true },
    });
    return res.status(201).json({ message: "註冊成功", user });
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

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
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

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.userId !== userId || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "無效或已過期的 Refresh Token" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: "無效或已過期的 Refresh Token" });
    }

    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    // 旋轉策略：刪舊建新
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ error: "無效或已過期的 Refresh Token" });
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
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

// PATCH /api/auth/me
router.patch(
  "/me",
  authMiddleware,
  nicknameRateLimit,
  validate(UpdateNicknameSchema),
  async (req, res) => {
    const { name } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name },
      select: { id: true, email: true, name: true },
    });

    return res.json({ message: "名稱已更新", user });
  },
);

// PATCH /api/auth/password
router.patch(
  "/password",
  authMiddleware,
  passwordRateLimit,
  validate(ChangePasswordSchema),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      return res.status(404).json({ error: "使用者不存在" });
    }
    if (!user.password) {
      return res.status(400).json({ error: "此帳號尚未設定密碼，請先完成註冊" });
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      // 刻意不用 401：fetchWithAuth 會把 401 當成 token 過期而觸發 refresh/強制登出
      return res.status(400).json({ error: "目前密碼不正確" });
    }

    const hashed = await hashPassword(newPassword);

    // 變更密碼視為重新驗證身分：撤銷所有裝置的 refresh token
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    res.clearCookie("refreshToken", { path: "/api/auth" });
    return res.json({ message: "密碼已更新，請重新登入" });
  },
);

export default router;
