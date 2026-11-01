const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');
const API_V1 = `${API_BASE}/api/v1`;

export class ApiClient {
  private static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('pdfforge_token');
  }

  private static setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('pdfforge_token', token);
    const expires = new Date(Date.now() + 7 * 864e5).toUTCString();
    document.cookie = `pdfforge_token=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    let res = await fetch(`${API_V1}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Auto-refresh token if 401 Unauthorized
    if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      try {
        const refreshRes = await fetch(`${API_V1}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccessToken = refreshData.accessToken || refreshData.tokens?.accessToken;
          if (newAccessToken) {
            this.setToken(newAccessToken);
            headers['Authorization'] = `Bearer ${newAccessToken}`;
            res = await fetch(`${API_V1}${endpoint}`, {
              ...options,
              headers,
              credentials: 'include',
            });
          }
        }
      } catch {
        // Continue to error parsing
      }
    }

    if (!res.ok) {
      let errorMessage = 'An error occurred during API request';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // fallback
      }
      throw new Error(errorMessage);
    }

    return res.json();
  }
}
