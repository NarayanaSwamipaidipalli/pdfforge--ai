/**
 * One-time migration: renames pdfforge_* storage keys to doxera_* without logging out existing users.
 * Called synchronously before the Zustand auth store is created so hydration reads from the new key.
 *
 * IMPORTANT – HttpOnly cookies:
 *   The server sets `pdfforge_refresh_token` as HttpOnly (not readable by JS). This shim cannot
 *   copy it. The middleware falls back to the old cookie name so existing refresh tokens continue
 *   to work until they expire naturally. No client-side migration attempt is made for HttpOnly cookies.
 *
 * Cookie security:
 *   The `Secure` attribute is added automatically when the page is served over HTTPS so the
 *   migrated cookie inherits the same transport security as the original.
 */

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookieMigration(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

export function migrateTokenKeys(): void {
  if (typeof window === 'undefined') return;

  // --- localStorage: pdfforge_token → doxera_token ---
  const oldToken = localStorage.getItem('pdfforge_token');
  if (oldToken !== null) {
    if (!localStorage.getItem('doxera_token')) {
      localStorage.setItem('doxera_token', oldToken);
    }
    localStorage.removeItem('pdfforge_token');
  }

  // --- localStorage: Zustand persist store ---
  const oldAuthStorage = localStorage.getItem('pdfforge_auth_storage');
  if (oldAuthStorage !== null) {
    if (!localStorage.getItem('doxera_auth_storage')) {
      localStorage.setItem('doxera_auth_storage', oldAuthStorage);
    }
    localStorage.removeItem('pdfforge_auth_storage');
  }

  // --- sessionStorage: Google OAuth link state ---
  try {
    const oldGoogleLinkState = sessionStorage.getItem('pdfforge_google_link_state');
    if (oldGoogleLinkState !== null) {
      if (!sessionStorage.getItem('doxera_google_link_state')) {
        sessionStorage.setItem('doxera_google_link_state', oldGoogleLinkState);
      }
      sessionStorage.removeItem('pdfforge_google_link_state');
    }
  } catch {
    // sessionStorage unavailable (e.g. private browsing restriction in some browsers)
  }

  // --- Cookies: set doxera_token from pdfforge_token (access token only; HttpOnly refresh
  //     token cannot be read or migrated by JS — the middleware fallback handles it). ---
  const tokenFromOldCookie = getCookieValue('pdfforge_token');
  if (tokenFromOldCookie && !getCookieValue('doxera_token')) {
    setCookieMigration('doxera_token', tokenFromOldCookie, 7);
  }
}
