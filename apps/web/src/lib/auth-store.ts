import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');
const API_V1 = `${API_BASE}/api/v1`;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  avatarUrl?: string | null;
  provider?: 'LOCAL' | 'GOOGLE' | 'GOOGLE_AND_LOCAL' | string | null;
  googleId?: string | null;
  isEmailVerified?: boolean;
  storageUsedBytes?: number | string;
  storageLimitBytes?: number | string;
  createdAt?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setAuth: (user: AuthUser, token: string) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<string | null>;
  syncProfile: () => Promise<void>;
}

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,

      setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),

      setAuth: (user: AuthUser, token: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('pdfforge_token', token);
          setCookie('pdfforge_token', token, 7);
        }
        set({ user, token, isAuthenticated: true });
      },

      updateUser: (partial: Partial<AuthUser>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        }));
      },

      logout: async () => {
        const token =
          get().token ||
          (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);

        try {
          if (token) {
            await fetch(`${API_V1}/auth/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            });
          }
        } catch (err) {
          console.warn('Backend logout notification failed:', err);
        } finally {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('pdfforge_token');
            deleteCookie('pdfforge_token');
          }
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      refreshTokens: async () => {
        try {
          const res = await fetch(`${API_V1}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });

          if (res.ok) {
            const data = await res.json();
            const newAccessToken = data.accessToken || data.tokens?.accessToken;
            if (newAccessToken) {
              if (typeof window !== 'undefined') {
                localStorage.setItem('pdfforge_token', newAccessToken);
                setCookie('pdfforge_token', newAccessToken, 7);
              }
              set((state) => ({
                token: newAccessToken,
                isAuthenticated: true,
              }));
              return newAccessToken;
            }
          }
        } catch (err) {
          console.warn('Automatic token refresh failed:', err);
        }
        return null;
      },

      syncProfile: async () => {
        let token =
          get().token ||
          (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);

        if (!token) return;

        try {
          let res = await fetch(`${API_V1}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
          });

          // If expired, attempt automatic token rotation
          if (res.status === 401) {
            const refreshedToken = await get().refreshTokens();
            if (refreshedToken) {
              token = refreshedToken;
              res = await fetch(`${API_V1}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
              });
            }
          }

          if (res.ok) {
            const data = await res.json();
            set({
              user: {
                id: data.id,
                email: data.email,
                name: data.name,
                role: data.globalRole || data.role || 'USER',
                plan: data.plan || 'FREE',
                avatarUrl: data.avatarUrl || null,
                provider: data.provider || 'LOCAL',
                googleId: data.googleId || null,
                isEmailVerified: data.isEmailVerified ?? false,
                storageUsedBytes: data.storageUsedBytes || 0,
                storageLimitBytes: data.storageLimitBytes || (1024 * 1024 * 1024), // 1 GB default
                createdAt: data.createdAt,
              },
              token,
              isAuthenticated: true,
            });
          } else if (res.status === 401) {
            await get().logout();
          }
        } catch (err) {
          console.warn('Could not sync user profile:', err);
        }
      },
    }),
    {
      name: 'pdfforge_auth_storage',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
    }
  )
);
