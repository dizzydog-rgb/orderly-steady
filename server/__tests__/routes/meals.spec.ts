// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

const { mockClassify } = vi.hoisted(() => ({ mockClassify: vi.fn() }));

vi.mock('../../db', () => ({
  default: {
    user: { upsert: vi.fn(), findUnique: vi.fn() },
    foodDictionary: { findUnique: vi.fn(), create: vi.fn() },
    userFoodOverride: { findUnique: vi.fn(), upsert: vi.fn() },
    mealRecord: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    foodItem: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/authService', () => ({
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockClassify };
  },
}));

import { app } from '../../app';
import prisma from '../../db';
import { verifyAccessToken } from '../../services/authService';

const USER = { id: 'u1', email: 'user@example.com' };
const TOKEN_PAYLOAD = { userId: 'u1', email: 'user@example.com' };

beforeAll(() => {
  // 同一個 IP 連續送出的測試請求不應被速率限制影響結果
  vi.stubEnv('RATE_LIMIT_DISABLED', 'true');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(verifyAccessToken).mockReturnValue(TOKEN_PAYLOAD);
  // 互動式 transaction：直接以同一個 mock client 執行 callback
  vi.mocked(prisma.$transaction).mockImplementation(((run: (tx: typeof prisma) => unknown) =>
    run(prisma)) as never);
});

describe('POST /api/meals — 個人覆寫', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(USER as never);
    vi.mocked(prisma.mealRecord.create).mockResolvedValue({ id: 'r1', foodItems: [] } as never);
  });

  it('201 — a logged-in user gets their own override instead of the global dictionary', async () => {
    vi.mocked(prisma.userFoodOverride.findUnique).mockResolvedValue({ type: 'PROTEIN' } as never);

    const res = await request(app)
      .post('/api/meals')
      .set('Authorization', 'Bearer valid-token')
      .send({ email: USER.email, foods: ['雞胸肉'] });

    expect(res.status).toBe(201);
    expect(res.body.analysis.breakdown[0].type).toBe('PROTEIN');
    expect(res.body.analysis.totalScore).toBe(60);
    expect(prisma.userFoodOverride.findUnique).toHaveBeenCalledWith({
      where: { userId_label: { userId: 'u1', label: '雞胸肉' } },
    });
    expect(prisma.foodDictionary.findUnique).not.toHaveBeenCalled();
    expect(mockClassify).not.toHaveBeenCalled();
  });

  it('201 — falls back to the global dictionary when the user has no override', async () => {
    vi.mocked(prisma.userFoodOverride.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.foodDictionary.findUnique).mockResolvedValue({ type: 'SIMPLE_CARB' } as never);

    const res = await request(app)
      .post('/api/meals')
      .set('Authorization', 'Bearer valid-token')
      .send({ email: USER.email, foods: ['雞胸肉'] });

    expect(res.status).toBe(201);
    expect(res.body.analysis.breakdown[0].type).toBe('SIMPLE_CARB');
    expect(res.body.analysis.totalScore).toBe(20);
  });

  it('201 — a guest never gets overrides, even with the email of a user who has them', async () => {
    vi.mocked(prisma.foodDictionary.findUnique).mockResolvedValue({ type: 'SIMPLE_CARB' } as never);

    const res = await request(app)
      .post('/api/meals')
      .send({ email: USER.email, foods: ['雞胸肉'] });

    expect(res.status).toBe(201);
    expect(res.body.analysis.breakdown[0].type).toBe('SIMPLE_CARB');
    expect(prisma.userFoodOverride.findUnique).not.toHaveBeenCalled();
  });

  it('201 — a token belonging to a different user does not unlock overrides for this email', async () => {
    vi.mocked(verifyAccessToken).mockReturnValue({ userId: 'someone-else', email: 'x@example.com' });
    vi.mocked(prisma.foodDictionary.findUnique).mockResolvedValue({ type: 'SIMPLE_CARB' } as never);

    const res = await request(app)
      .post('/api/meals')
      .set('Authorization', 'Bearer valid-token')
      .send({ email: USER.email, foods: ['雞胸肉'] });

    expect(res.status).toBe(201);
    expect(prisma.userFoodOverride.findUnique).not.toHaveBeenCalled();
  });

  it('401 — an invalid token is rejected instead of being treated as a guest', async () => {
    vi.mocked(verifyAccessToken).mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const res = await request(app)
      .post('/api/meals')
      .set('Authorization', 'Bearer expired-token')
      .send({ email: USER.email, foods: ['雞胸肉'] });

    expect(res.status).toBe(401);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('201 — looks up the dictionary with the normalized label', async () => {
    vi.mocked(prisma.foodDictionary.findUnique).mockResolvedValue({ type: 'PROTEIN' } as never);

    const res = await request(app)
      .post('/api/meals')
      .send({ email: USER.email, foods: ['　ＢＢＱ雞胸 '] });

    expect(res.status).toBe(201);
    expect(prisma.foodDictionary.findUnique).toHaveBeenCalledWith({ where: { label: 'BBQ雞胸' } });
  });

  it('400 — a label that is empty after normalization', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ email: USER.email, foods: ['　'] });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('foods.0');
  });
});

describe('PATCH /api/meals/:recordId/items/:sequenceIndex', () => {
  const RECORD = {
    id: 'r1',
    userId: 'u1',
    totalScore: 30,
    foodItems: [
      { id: 'f0', label: '雞胸肉', type: 'SIMPLE_CARB', sequenceIndex: 0 },
      { id: 'f1', label: '糙米', type: 'COMPLEX_CARB', sequenceIndex: 1 },
    ],
  };

  it('200 — updates the item, stores the override and rescores the meal', async () => {
    const updatedRecord = { ...RECORD, totalScore: 100 };
    vi.mocked(prisma.mealRecord.findUnique).mockResolvedValue(RECORD as never);
    vi.mocked(prisma.mealRecord.update).mockResolvedValue(updatedRecord as never);

    const res = await request(app)
      .patch('/api/meals/r1/items/0')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'PROTEIN' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.totalScore).toBe(100);
    expect(res.body.analysis.breakdown).toMatchObject([
      { slot: 1, label: '雞胸肉', type: 'PROTEIN' },
      { slot: 2, label: '糙米', type: 'COMPLEX_CARB' },
    ]);
    expect(res.body.record).toEqual(updatedRecord);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.userFoodOverride.upsert).toHaveBeenCalledWith({
      where: { userId_label: { userId: 'u1', label: '雞胸肉' } },
      update: { type: 'PROTEIN' },
      create: { userId: 'u1', label: '雞胸肉', type: 'PROTEIN' },
    });
    expect(prisma.foodItem.update).toHaveBeenCalledWith({
      where: { id: 'f0' },
      data: { type: 'PROTEIN' },
    });
    expect(prisma.mealRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: { totalScore: 100, tips: res.body.analysis.tips },
      })
    );
  });

  it('200 — deletes the record when every item ends up as OTHER', async () => {
    vi.mocked(prisma.mealRecord.findUnique).mockResolvedValue({
      ...RECORD,
      foodItems: [RECORD.foodItems[0]],
    } as never);

    const res = await request(app)
      .patch('/api/meals/r1/items/0')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'OTHER' });

    expect(res.status).toBe(200);
    expect(res.body.record).toBeNull();
    expect(res.body.analysis.totalScore).toBeNull();
    expect(prisma.userFoodOverride.upsert).toHaveBeenCalledOnce();
    expect(prisma.mealRecord.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(prisma.mealRecord.update).not.toHaveBeenCalled();
    expect(prisma.foodItem.update).not.toHaveBeenCalled();
  });

  it('401 — without an Authorization header', async () => {
    const res = await request(app).patch('/api/meals/r1/items/0').send({ type: 'PROTEIN' });

    expect(res.status).toBe(401);
  });

  it('400 — unknown food type', async () => {
    const res = await request(app)
      .patch('/api/meals/r1/items/0')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'SUGAR' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('type');
    expect(prisma.mealRecord.findUnique).not.toHaveBeenCalled();
  });

  it('404 — record does not exist', async () => {
    vi.mocked(prisma.mealRecord.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/meals/missing/items/0')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'PROTEIN' });

    expect(res.status).toBe(404);
  });

  it("403 — another user's record, and nothing is written", async () => {
    vi.mocked(prisma.mealRecord.findUnique).mockResolvedValue({
      ...RECORD,
      userId: 'someone-else',
    } as never);

    const res = await request(app)
      .patch('/api/meals/r1/items/0')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'PROTEIN' });

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.userFoodOverride.upsert).not.toHaveBeenCalled();
  });

  it('404 — sequenceIndex has no food item', async () => {
    vi.mocked(prisma.mealRecord.findUnique).mockResolvedValue(RECORD as never);

    const res = await request(app)
      .patch('/api/meals/r1/items/2')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'PROTEIN' });

    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('PUT /api/food-overrides', () => {
  it('200 — upserts the override under the normalized label', async () => {
    vi.mocked(prisma.userFoodOverride.upsert).mockResolvedValue({
      label: '雞胸肉',
      type: 'PROTEIN',
    } as never);

    const res = await request(app)
      .put('/api/food-overrides')
      .set('Authorization', 'Bearer valid-token')
      .send({ label: ' 雞胸肉　', type: 'PROTEIN' });

    expect(res.status).toBe(200);
    expect(res.body.override).toEqual({ label: '雞胸肉', type: 'PROTEIN' });
    expect(prisma.userFoodOverride.upsert).toHaveBeenCalledWith({
      where: { userId_label: { userId: 'u1', label: '雞胸肉' } },
      update: { type: 'PROTEIN' },
      create: { userId: 'u1', label: '雞胸肉', type: 'PROTEIN' },
    });
  });

  it('401 — without an Authorization header', async () => {
    const res = await request(app)
      .put('/api/food-overrides')
      .send({ label: '雞胸肉', type: 'PROTEIN' });

    expect(res.status).toBe(401);
  });

  it('400 — blank label', async () => {
    const res = await request(app)
      .put('/api/food-overrides')
      .set('Authorization', 'Bearer valid-token')
      .send({ label: '   ', type: 'PROTEIN' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('label');
    expect(prisma.userFoodOverride.upsert).not.toHaveBeenCalled();
  });
});
