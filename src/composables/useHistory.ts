import { ref } from 'vue';
import type { IMealRecord } from '../types';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useAuthStore } from '../stores/auth';

const records = ref<IMealRecord[]>([]);
const isLoading = ref(false);
const fetchError = ref<string | null>(null);

export async function fetchHistory(): Promise<void> {
  const authStore = useAuthStore();
  if (!authStore.user) return;
  isLoading.value = true;
  fetchError.value = null;
  try {
    const res = await fetchWithAuth(`/api/meals/${authStore.user!.id}`);
    if (res.ok) {
      const data = await res.json();
      records.value = Array.isArray(data) ? data : (data.records ?? []);
    } else {
      fetchError.value = '載入紀錄失敗，請稍後再試';
    }
  } catch {
    fetchError.value = '網路錯誤，請確認連線後重試';
  } finally {
    isLoading.value = false;
  }
}

export function prependRecord(record: IMealRecord): void {
  records.value.unshift(record);
}

export function useHistory() {
  return { records, isLoading, error: fetchError, fetchHistory, prependRecord };
}
