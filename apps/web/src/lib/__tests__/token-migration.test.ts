/**
 * Tests for token-migration.ts
 * Run: npm test  (or npx vitest run)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrateTokenKeys } from '../token-migration';

// ---------------------------------------------------------------------------
// Storage stub
// ---------------------------------------------------------------------------
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

// ---------------------------------------------------------------------------
// Cookie jar: simulates JS-readable (non-HttpOnly) cookies.
// HttpOnly cookies are NOT present here because the browser does not expose
// them to document.cookie — this stub correctly models that behaviour.
// ---------------------------------------------------------------------------
function makeCookieJar() {
  const jar: Record<string, string> = {};
  return {
    get cookie() {
      return Object.entries(jar)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    },
    set cookie(raw: string) {
      const semi = raw.indexOf(';');
      const pair = semi === -1 ? raw : raw.slice(0, semi);
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (value === '') { delete jar[name]; return; }
      jar[name] = decodeURIComponent(value);
    },
    _jar: jar,
    /** Returns the raw Set-Cookie string most recently written via `document.cookie =` */
    _lastRaw: undefined as string | undefined,
  };
}

type CookieJar = ReturnType<typeof makeCookieJar>;

// Keep track of raw cookie strings to test attributes (Secure, SameSite, Path, expires).
function makeCookieJarWithRaw() {
  const jar = makeCookieJar();
  const rawWrites: string[] = [];
  const target = {
    ...jar,
    get cookie() { return jar.cookie; },
    set cookie(raw: string) {
      rawWrites.push(raw);
      jar.cookie = raw;
    },
    get _rawWrites() { return rawWrites; },
    get _jar() { return jar._jar; },
  };
  return target;
}

type RawCookieJar = ReturnType<typeof makeCookieJarWithRaw>;

// ---------------------------------------------------------------------------
// Global setup helpers
// ---------------------------------------------------------------------------
function setupGlobals(ls: Storage, ss: Storage, doc: CookieJar | RawCookieJar) {
  (global as any).window = {};
  (global as any).localStorage = ls;
  (global as any).sessionStorage = ss;
  (global as any).document = doc;
  // location.protocol defaults to http (no Secure flag in test env)
  (global as any).location = { protocol: 'http:' };
}

function teardownGlobals() {
  (global as any).window = undefined;
  delete (global as any).localStorage;
  delete (global as any).sessionStorage;
  delete (global as any).document;
  delete (global as any).location;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('migrateTokenKeys — localStorage', () => {
  let ls: Storage;
  let ss: Storage;
  let doc: RawCookieJar;

  beforeEach(() => {
    ls = makeStorage();
    ss = makeStorage();
    doc = makeCookieJarWithRaw();
    setupGlobals(ls, ss, doc);
  });

  afterEach(teardownGlobals);

  it('copies pdfforge_token to doxera_token and removes old key', () => {
    ls.setItem('pdfforge_token', 'tok123');
    migrateTokenKeys();
    expect(ls.getItem('doxera_token')).toBe('tok123');
    expect(ls.getItem('pdfforge_token')).toBeNull();
  });

  it('does not overwrite an existing doxera_token', () => {
    ls.setItem('pdfforge_token', 'old-tok');
    ls.setItem('doxera_token', 'keep-this');
    migrateTokenKeys();
    expect(ls.getItem('doxera_token')).toBe('keep-this');
    expect(ls.getItem('pdfforge_token')).toBeNull();
  });

  it('is a no-op when neither key exists', () => {
    migrateTokenKeys();
    expect(ls.getItem('doxera_token')).toBeNull();
    expect(ls.getItem('pdfforge_token')).toBeNull();
  });

  it('is idempotent: calling twice leaves state stable', () => {
    ls.setItem('pdfforge_token', 'tok123');
    migrateTokenKeys();
    migrateTokenKeys();
    expect(ls.getItem('doxera_token')).toBe('tok123');
    expect(ls.getItem('pdfforge_token')).toBeNull();
  });

  it('leaves doxera_token only when only doxera_token was present', () => {
    ls.setItem('doxera_token', 'already-new');
    migrateTokenKeys();
    expect(ls.getItem('doxera_token')).toBe('already-new');
  });

  it('migrates pdfforge_auth_storage to doxera_auth_storage', () => {
    const payload = JSON.stringify({
      state: { user: { id: '1' }, token: 'tok', isAuthenticated: true },
      version: 0,
    });
    ls.setItem('pdfforge_auth_storage', payload);
    migrateTokenKeys();
    expect(ls.getItem('doxera_auth_storage')).toBe(payload);
    expect(ls.getItem('pdfforge_auth_storage')).toBeNull();
  });

  it('does not overwrite existing doxera_auth_storage', () => {
    ls.setItem('pdfforge_auth_storage', '{"old":true}');
    ls.setItem('doxera_auth_storage', '{"new":true}');
    migrateTokenKeys();
    expect(ls.getItem('doxera_auth_storage')).toBe('{"new":true}');
    expect(ls.getItem('pdfforge_auth_storage')).toBeNull();
  });
});

describe('migrateTokenKeys — sessionStorage', () => {
  let ls: Storage;
  let ss: Storage;
  let doc: RawCookieJar;

  beforeEach(() => {
    ls = makeStorage();
    ss = makeStorage();
    doc = makeCookieJarWithRaw();
    setupGlobals(ls, ss, doc);
  });

  afterEach(teardownGlobals);

  it('migrates pdfforge_google_link_state to doxera_google_link_state', () => {
    ss.setItem('pdfforge_google_link_state', 'state-abc');
    migrateTokenKeys();
    expect(ss.getItem('doxera_google_link_state')).toBe('state-abc');
    expect(ss.getItem('pdfforge_google_link_state')).toBeNull();
  });

  it('does not overwrite an existing doxera_google_link_state', () => {
    ss.setItem('pdfforge_google_link_state', 'old');
    ss.setItem('doxera_google_link_state', 'keep');
    migrateTokenKeys();
    expect(ss.getItem('doxera_google_link_state')).toBe('keep');
    expect(ss.getItem('pdfforge_google_link_state')).toBeNull();
  });

  it('does not throw if sessionStorage throws (private browsing restriction)', () => {
    const throwingStorage: Storage = {
      ...makeStorage(),
      getItem: () => { throw new Error('QuotaExceededError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('QuotaExceededError'); },
    } as any;
    (global as any).sessionStorage = throwingStorage;
    expect(() => migrateTokenKeys()).not.toThrow();
  });
});

describe('migrateTokenKeys — cookies', () => {
  let ls: Storage;
  let ss: Storage;
  let doc: RawCookieJar;

  beforeEach(() => {
    ls = makeStorage();
    ss = makeStorage();
    doc = makeCookieJarWithRaw();
    setupGlobals(ls, ss, doc);
  });

  afterEach(teardownGlobals);

  it('sets doxera_token cookie from pdfforge_token cookie when absent', () => {
    doc._jar['pdfforge_token'] = 'cookie-tok';
    migrateTokenKeys();
    expect(doc._jar['doxera_token']).toBe('cookie-tok');
  });

  it('does not overwrite an existing doxera_token cookie', () => {
    doc._jar['pdfforge_token'] = 'old';
    doc._jar['doxera_token'] = 'keep';
    migrateTokenKeys();
    expect(doc._jar['doxera_token']).toBe('keep');
  });

  it('does not set doxera_token cookie when no pdfforge_token cookie exists', () => {
    migrateTokenKeys();
    expect(doc._jar['doxera_token']).toBeUndefined();
  });

  it('writes cookie with SameSite=Lax and Path=/', () => {
    doc._jar['pdfforge_token'] = 'cookie-tok';
    migrateTokenKeys();
    const rawWrite = doc._rawWrites.find((r) => r.startsWith('doxera_token='));
    expect(rawWrite).toBeDefined();
    expect(rawWrite).toContain('SameSite=Lax');
    expect(rawWrite).toContain('path=/');
  });

  it('does NOT add Secure attribute when protocol is http (dev environment)', () => {
    (global as any).location = { protocol: 'http:' };
    doc._jar['pdfforge_token'] = 'tok';
    migrateTokenKeys();
    const rawWrite = doc._rawWrites.find((r) => r.startsWith('doxera_token='));
    expect(rawWrite).toBeDefined();
    expect(rawWrite).not.toContain('; Secure');
  });

  it('adds Secure attribute when protocol is https', () => {
    (global as any).location = { protocol: 'https:' };
    doc._jar['pdfforge_token'] = 'tok';
    migrateTokenKeys();
    const rawWrite = doc._rawWrites.find((r) => r.startsWith('doxera_token='));
    expect(rawWrite).toBeDefined();
    expect(rawWrite).toContain('; Secure');
  });

  /**
   * HttpOnly cookies (like pdfforge_refresh_token) are NOT visible in document.cookie.
   * The migration shim intentionally does NOT attempt to migrate them.
   * The middleware falls back to pdfforge_refresh_token until it expires.
   */
  it('does not attempt to migrate HttpOnly cookies — only JS-readable cookies appear in document.cookie', () => {
    // Simulate: pdfforge_refresh_token is HttpOnly and therefore absent from document.cookie.
    // Only pdfforge_token is present (it was set by JS, so it IS readable).
    doc._jar['pdfforge_token'] = 'access-tok';
    // pdfforge_refresh_token is NOT in the jar (HttpOnly → invisible to JS)
    migrateTokenKeys();
    // The shim correctly migrates the access token and leaves refresh token to the middleware fallback.
    expect(doc._jar['doxera_token']).toBe('access-tok');
    expect(doc._jar['doxera_refresh_token']).toBeUndefined();
  });
});

describe('migrateTokenKeys — SSR and edge cases', () => {
  afterEach(teardownGlobals);

  it('skips entirely when window is undefined (SSR)', () => {
    (global as any).window = undefined;
    expect(() => migrateTokenKeys()).not.toThrow();
  });

  it('handles tokens that contain URL-unsafe characters after encoding round-trip', () => {
    const ls = makeStorage();
    const ss = makeStorage();
    const doc = makeCookieJarWithRaw();
    setupGlobals(ls, ss, doc);

    // JWT tokens contain dots and dashes, not special, but test with = in base64
    const jwtLike = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.abc=';
    ls.setItem('pdfforge_token', jwtLike);
    doc._jar['pdfforge_token'] = jwtLike;
    migrateTokenKeys();
    expect(ls.getItem('doxera_token')).toBe(jwtLike);
    expect(doc._jar['doxera_token']).toBe(jwtLike);
  });

  it('conflicting keys: doxera_token wins over pdfforge_token (middleware precedence preserved)', () => {
    // If both cookies are present in the browser (e.g. from a partial deployment),
    // the new key takes precedence — the old one is never promoted.
    const ls = makeStorage();
    const ss = makeStorage();
    const doc = makeCookieJarWithRaw();
    setupGlobals(ls, ss, doc);

    ls.setItem('pdfforge_token', 'old-access-tok');
    ls.setItem('doxera_token', 'new-access-tok');
    doc._jar['pdfforge_token'] = 'old-cookie-tok';
    doc._jar['doxera_token'] = 'new-cookie-tok';
    migrateTokenKeys();

    // localStorage: old key removed, new key untouched
    expect(ls.getItem('doxera_token')).toBe('new-access-tok');
    expect(ls.getItem('pdfforge_token')).toBeNull();
    // Cookie: old cookie NOT overriding new one
    expect(doc._jar['doxera_token']).toBe('new-cookie-tok');
  });
});
