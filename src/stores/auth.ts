import { defineStore } from 'pinia';
import type { IUser } from '../types';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null as string | null,
    user: null as IUser | null,
    _refreshPromise: null as Promise<boolean> | null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.accessToken,
    getAuthHeaders: (s) => (): Record<string, string> =>
      s.accessToken ? { Authorization: `Bearer ${s.accessToken}` } : {},
  },
  actions: {
    async login(email: string, password: string): Promise<void> {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? '登入失敗');
      }
      const data = await res.json();
      this.accessToken = data.accessToken;
      this.user = data.user;
    },

    async register(email: string, password: string, name?: string): Promise<void> {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? '註冊失敗');
      }
      await this.login(email, password);
    },

    async refreshAccessToken(): Promise<boolean> {
      if (this._refreshPromise) return this._refreshPromise;

      this._refreshPromise = (async () => {
        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          if (!res.ok) {
            this._clearState();
            return false;
          }
          const data = await res.json();
          this.accessToken = data.accessToken;
          return true;
        } catch {
          this._clearState();
          return false;
        } finally {
          this._refreshPromise = null;
        }
      })();

      return this._refreshPromise;
    },

    async logout(): Promise<void> {
      const token = this.accessToken;
      this._clearState();

      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }).catch(() => {});
      }
    },

    _clearState() {
      this.accessToken = null;
      this.user = null;
    },
  },
});
