import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  email: string;
}

const SALT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  });
}

export function generateRefreshToken(payload: Pick<TokenPayload, "userId">): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d" }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}

export function verifyRefreshToken(token: string): Pick<TokenPayload, "userId"> {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as Pick<TokenPayload, "userId">;
}
