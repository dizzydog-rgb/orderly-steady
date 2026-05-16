import { ref } from 'vue';
import type { IMealRecord } from '../types';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useAuth } from './useAuth';

const records = ref<IMealRecord[]>([]);
const isLoading = ref(false);

export async function fetchHistory(): Promise<void> {
  const { user } = useAuth();
  if (!user.value) return;
  isLoading.value = true;
  try {
    const res = await fetchWithAuth(`/api/meals/${user.value.id}`);
    if (res.ok) {
      const data = await res.json();
      records.value = Array.isArray(data) ? data : (data.records ?? []);
    }
  } finally {
    isLoading.value = false;
  }
}

export function prependRecord(record: IMealRecord): void {
  records.value.unshift(record);
}

export function useHistory() {
  return { records, isLoading, fetchHistory, prependRecord };
}
