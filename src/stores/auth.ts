import { defineStore } from 'pinia';
import type {
  IUser,
  IApiErrorResponse,
  IChangePasswordRequest,
  IUpdateNicknameRequest,
  IUpdateNicknameResponse,
} from '../types';
import { useHistoryStore } from './history';
import { apiUrl } from '../utils/apiUrl';
import { fetchWithAuth } from '../utils/fetchWithAuth';

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
      const res = await fetch(apiUrl('/api/auth/login'), {
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
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.details?.[0]?.message ?? err.error ?? '註冊失敗';
        throw new Error(msg);
      }
      await this.login(email, password);
    },

    async refreshAccessToken(): Promise<boolean> {
      if (this._refreshPromise) return this._refreshPromise;

      this._refreshPromise = (async () => {
        try {
          const res = await fetch(apiUrl('/api/auth/refresh'), {
            method: 'POST',
            credentials: 'include',
          });
          if (!res.ok) {
            this._clearState();
            return false;
          }
          const data = await res.json();
          this.accessToken = data.accessToken;

          const meRes = await fetch(apiUrl('/api/auth/me'), {
            headers: { Authorization: `Bearer ${data.accessToken}` },
            credentials: 'include',
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            this.user = meData.user;
          }

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
      useHistoryStore().reset();

      if (token) {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }).catch(() => {});
      }
    },

    async updateNickname(name: string): Promise<void> {
      const body: IUpdateNicknameRequest = { name };
      const res = await fetchWithAuth(apiUrl('/api/auth/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err: Partial<IApiErrorResponse> = await res.json().catch(() => ({}));
        throw new Error(err.details?.[0]?.message ?? err.error ?? '名稱更新失敗');
      }
      const data: IUpdateNicknameResponse = await res.json();
      this.user = data.user;
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      const body: IChangePasswordRequest = { currentPassword, newPassword };
      const res = await fetchWithAuth(apiUrl('/api/auth/password'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err: Partial<IApiErrorResponse> = await res.json().catch(() => ({}));
        throw new Error(err.details?.[0]?.message ?? err.error ?? '密碼變更失敗');
      }
      // 後端已撤銷所有裝置的 refresh token，本地狀態一併清掉；導航交由呼叫端的 view
      this._clearState();
      useHistoryStore().reset();
    },

    _clearState() {
      this.accessToken = null;
      this.user = null;
    },
  },
});
