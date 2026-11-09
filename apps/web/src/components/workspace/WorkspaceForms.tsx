'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export const inputClass = 'focus-ring w-full min-w-0 rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] disabled:opacity-60';
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block space-y-2 text-sm"><span className="font-medium">{label}</span>{children}{hint && <span className="block text-xs leading-relaxed text-[var(--muted)]">{hint}</span>}</label>;
}

export function Panel({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id?: string }) {
  return <section id={id} className="surface min-w-0 scroll-mt-28 rounded-2xl p-5 sm:p-7"><h2 className="text-lg font-semibold tracking-tight">{title}</h2>{description && <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>}<div className="mt-6 space-y-5">{children}</div></section>;
}

export const UNEXPECTED_RESPONSE = 'The service returned an unexpected response. Please try again.';

/** Validator for list endpoints whose items must at least carry a string id. */
export function isListOf<T extends { id: string }>(value: unknown): value is T[] {
  return Array.isArray(value) && value.every(item => !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string');
}

export function useWorkspaceResource<T>(endpoint: string, enabled = true, validate?: (value: unknown) => value is T) {
  // Held in a ref so an inline validator does not retrigger the request every render.
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !enabled) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    ApiClient.request<unknown>(endpoint, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (validateRef.current && !validateRef.current(result)) { setData(null); setError(UNEXPECTED_RESPONSE); return; }
      setData(result as T);
    }).catch(error => {
      if (!controller.signal.aborted) setError(errorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, enabled, isAuthenticated, isHydrated, version]);
  return { data, error, loading, reload };
}
