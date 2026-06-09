import { defineStore } from 'pinia';
import type { IMealRecord } from '../types';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useAuthStore } from './auth';
import { apiUrl } from '../utils/apiUrl';

export const useHistoryStore = defineStore('history', {
  state: () => ({
    records: [] as IMealRecord[],
    isLoading: false,
    error: null as string | null,
    hasFetched: false,
  }),
  actions: {
    async fetchHistory() {
      if (this.hasFetched) return;
      const authStore = useAuthStore();
      if (!authStore.user) return;
      this.isLoading = true;
      this.error = null;
      try {
        const res = await fetchWithAuth(apiUrl(`/api/meals/${authStore.user.id}`));
        if (res.ok) {
          const data = await res.json();
          this.records = data.records ?? [];
          this.hasFetched = true;
        } else {
          this.error = '載入紀錄失敗，請稍後再試';
        }
      } catch {
        this.error = '網路錯誤，請確認連線後重試';
      } finally {
        this.isLoading = false;
      }
    },
    prependRecord(record: IMealRecord) {
      this.records.unshift(record);
    },
    reset() {
      this.$reset();
    },
  },
});
