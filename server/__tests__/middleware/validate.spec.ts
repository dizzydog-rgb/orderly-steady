// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../middleware/validate';
import {
  RegisterSchema,
  UpdateNicknameSchema,
  ChangePasswordSchema,
} from '../../schemas/auth.schemas';
import { CreateMealSchema } from '../../schemas/meals.schemas';

function makeReqRes(body: unknown) {
  const req: any = { body };
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('validate middleware', () => {
  it('calls next() and strips extra fields for valid RegisterSchema input', () => {
    const { req, res, next } = makeReqRes({
      email: 'user@example.com',
      password: 'password123',
      extraField: 'should-be-removed',
    });
    validate(RegisterSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).not.toHaveProperty('extraField');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with field="email" for invalid email format', () => {
    const { req, res, next } = makeReqRes({ email: 'not-an-email', password: 'password123' });
    validate(RegisterSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('請求格式錯誤');
    expect(body.details[0].field).toBe('email');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 with field="password" when password < 8 chars', () => {
    const { req, res, next } = makeReqRes({ email: 'user@example.com', password: 'short' });
    validate(RegisterSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.details[0].field).toBe('password');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 with field="foods" when foods is empty array', () => {
    const { req, res, next } = makeReqRes({ email: 'user@example.com', foods: [] });
    validate(CreateMealSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.details[0].field).toBe('foods');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when foods has more than 3 items', () => {
    const { req, res, next } = makeReqRes({ email: 'user@example.com', foods: ['a', 'b', 'c', 'd'] });
    validate(CreateMealSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('validate middleware — UpdateNicknameSchema', () => {
  it('trims the nickname before handing it to the handler', () => {
    const { req, res, next } = makeReqRes({ name: '  小林  ' });
    validate(UpdateNicknameSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body.name).toBe('小林');
  });

  it('returns 400 with field="name" for a whitespace-only nickname', () => {
    const { req, res, next } = makeReqRes({ name: '   ' });
    validate(UpdateNicknameSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].details[0].field).toBe('name');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 with field="name" when nickname exceeds 50 chars', () => {
    const { req, res, next } = makeReqRes({ name: 'a'.repeat(51) });
    validate(UpdateNicknameSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].details[0].field).toBe('name');
  });
});

describe('validate middleware — ChangePasswordSchema', () => {
  it('calls next() for a valid password change payload', () => {
    const { req, res, next } = makeReqRes({
      currentPassword: 'password123',
      newPassword: 'newpassword456',
    });
    validate(ChangePasswordSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with field="newPassword" when it equals the current password', () => {
    const { req, res, next } = makeReqRes({
      currentPassword: 'password123',
      newPassword: 'password123',
    });
    validate(ChangePasswordSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].details[0].field).toBe('newPassword');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 with field="newPassword" when shorter than 8 chars', () => {
    const { req, res, next } = makeReqRes({ currentPassword: 'password123', newPassword: 'short' });
    validate(ChangePasswordSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].details[0].field).toBe('newPassword');
  });
});
