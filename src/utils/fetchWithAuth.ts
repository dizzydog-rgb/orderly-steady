import { useAuthStore } from '../stores/auth';

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const store = useAuthStore();
  const headers = { ...(options.headers as Record<string, string> ?? {}), ...store.getAuthHeaders() };
  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    const ok = await store.refreshAccessToken();
    if (!ok) {
      await store.logout();
      window.location.href = '/login';
      return res;
    }
    const retryHeaders = { ...(options.headers as Record<string, string> ?? {}), ...store.getAuthHeaders() };
    res = await fetch(url, { ...options, headers: retryHeaders, credentials: 'include' });
  }

  return res;
}
