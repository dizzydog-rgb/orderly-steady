import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../services/authService";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  const token = authHeader.slice(7);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Token 無效或已過期" });
  }
}

// 訪客與登入者共用的端點使用：未帶 Authorization 視為訪客放行。
// 有帶但無效時仍回 401（而非當成訪客），前端 fetchWithAuth 才會 refresh 後重試，
// 否則 access token 過期的登入者會被靜默當成訪客處理。
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.headers.authorization) return next();
  return authMiddleware(req, res, next);
}
