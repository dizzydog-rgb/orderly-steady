// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/authService', () => ({
  verifyAccessToken: vi.fn(),
}));

import { authMiddleware } from '../../middleware/authMiddleware';
import { verifyAccessToken } from '../../services/authService';

describe('authMiddleware', () => {
  let req: any;
  let res: any;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '未提供 Token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with "Bearer "', () => {
    req.headers.authorization = 'Token abc123';
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.user for a valid token', () => {
    req.headers.authorization = 'Bearer valid-token';
    vi.mocked(verifyAccessToken).mockReturnValue({ userId: 'u1', email: 'test@example.com' });

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ userId: 'u1', email: 'test@example.com' });
  });

  it('returns 401 when verifyAccessToken throws (expired/invalid token)', () => {
    req.headers.authorization = 'Bearer expired-token';
    vi.mocked(verifyAccessToken).mockImplementation(() => { throw new Error('jwt expired'); });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token 無效或已過期' });
    expect(next).not.toHaveBeenCalled();
  });
});
