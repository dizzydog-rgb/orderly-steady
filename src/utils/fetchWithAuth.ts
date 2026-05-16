import { getAuthHeaders, refreshAccessToken, logout } from '../composables/useAuth';

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = { ...(options.headers as Record<string, string> ?? {}), ...getAuthHeaders() };
  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (!ok) {
      await logout();
      window.location.href = '/login';
      return res;
    }
    const retryHeaders = { ...(options.headers as Record<string, string> ?? {}), ...getAuthHeaders() };
    res = await fetch(url, { ...options, headers: retryHeaders });
  }

  return res;
}
