import { ref, computed } from 'vue';
import type { IUser } from '../types';

const user = ref<IUser | null>(null);
const accessToken = ref<string | null>(null);

export const isLoggedIn = computed(() => !!accessToken.value);

export function getAuthHeaders(): Record<string, string> {
  if (!accessToken.value) return {};
  return { Authorization: `Bearer ${accessToken.value}` };
}

export async function refreshAccessToken(): Promise<boolean> {
  const stored = localStorage.getItem('refreshToken');
  if (!stored) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    });
    if (!res.ok) {
      localStorage.removeItem('refreshToken');
      return false;
    }
    const data = await res.json();
    accessToken.value = data.accessToken;
    localStorage.setItem('refreshToken', data.refreshToken);
    user.value = data.user ?? user.value;
    return true;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? '登入失敗');
  }
  const data = await res.json();
  accessToken.value = data.accessToken;
  localStorage.setItem('refreshToken', data.refreshToken);
  user.value = data.user;
}

export async function register(email: string, password: string, name?: string): Promise<void> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? '註冊失敗');
  }
  await login(email, password);
}

export async function logout(): Promise<void> {
  accessToken.value = null;
  user.value = null;
  localStorage.removeItem('refreshToken');
}

export function useAuth() {
  return { user, accessToken, isLoggedIn, login, register, logout, refreshAccessToken, getAuthHeaders };
}
