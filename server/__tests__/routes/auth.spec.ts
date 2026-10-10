// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/authService', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  comparePassword: vi.fn(),
  generateAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

import { app } from '../../app';
import prisma from '../../db';
import { comparePassword, verifyAccessToken } from '../../services/authService';

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 — creates user for valid input', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'u1',
      email: 'new@example.com',
      name: null,
    } as any);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('new@example.com');
  });

  it('409 — email already registered with password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'dup@example.com',
      password: 'hashed-password',
    } as any);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('201 — completes registration for meals-created account (password=null)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'meal@example.com',
      password: null,
      name: null,
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'u1',
      email: 'meal@example.com',
      name: null,
    } as any);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'meal@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'meal@example.com' } })
    );
  });

  it('400 — invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('email');
  });

  it('400 — password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('password');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 — returns accessToken for valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      password: 'hashed-password',
      name: null,
    } as any);
    vi.mocked(comparePassword).mockResolvedValue(true as never);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });

  it('200 — second device login creates a second RefreshToken (multi-device)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      password: 'hashed-password',
      name: null,
    } as any);
    vi.mocked(comparePassword).mockResolvedValue(true as never);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });

    // 兩次登入各自建立一筆 RefreshToken，不互相覆蓋
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(2);
  });

  it('401 — user not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notfound@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('401 — wrong password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      password: 'hashed-password',
      name: null,
    } as any);
    vi.mocked(comparePassword).mockResolvedValue(false as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('400 — invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('email');
  });
});

const TOKEN_PAYLOAD = { userId: 'u1', email: 'user@example.com' };
const EXISTING_USER = { id: 'u1', email: 'user@example.com', password: 'hashed-password', name: '小林' };

describe('PATCH /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAccessToken).mockReturnValue(TOKEN_PAYLOAD);
  });

  it('200 — updates the nickname', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: '新名稱',
    } as any);

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '新名稱' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('新名稱');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { name: '新名稱' } })
    );
  });

  it('400 — rejects a whitespace-only nickname', async () => {
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('name');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('401 — without an Authorization header', async () => {
    const res = await request(app).patch('/api/auth/me').send({ name: '新名稱' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAccessToken).mockReturnValue(TOKEN_PAYLOAD);
  });

  it('200 — updates the hash and revokes refresh tokens on every device', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(EXISTING_USER as any);
    vi.mocked(comparePassword).mockResolvedValue(true as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as any);

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { password: 'hashed-password' } })
    );
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('400 — wrong current password (never 401, which would trigger a token refresh)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(EXISTING_USER as any);
    vi.mocked(comparePassword).mockResolvedValue(false as never);

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('目前密碼不正確');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('400 — new password identical to the current one', async () => {
    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ currentPassword: 'password123', newPassword: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('newPassword');
  });

  it('400 — account created by the meals endpoint has no password yet', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...EXISTING_USER,
      password: null,
    } as any);

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('404 — user no longer exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

    expect(res.status).toBe(404);
  });
});
