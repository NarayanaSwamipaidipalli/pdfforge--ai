import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  syncProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user: AuthUser, token: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('pdfforge_token', token);
        }
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pdfforge_token');
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      syncProfile: async () => {
        const token =
          get().token ||
          (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
        if (!token) return;

        try {
          const res = await fetch('http://localhost:4000/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const data = await res.json();
            set({
              user: {
                id: data.id,
                email: data.email,
                name: data.name,
                role: data.globalRole || 'USER',
                plan: data.plan || 'FREE',
              },
              token,
              isAuthenticated: true,
            });
          } else if (res.status === 401) {
            get().logout();
          }
        } catch (err) {
          console.warn('Could not sync user profile:', err);
        }
      },
    }),
    {
      name: 'pdfforge_auth_storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
    }
  )
);
