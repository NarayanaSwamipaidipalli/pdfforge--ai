/** Accept local application paths only; query parameters must never select another origin or script URL. */
export function safeLocalRedirect(target, fallback = '/dashboard') {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || /[\\\x00-\x20\x7f]/.test(target)) return fallback;
  try {
    let decoded = target;
    for (let depth = 0; depth < 4; depth++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (decoded.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(decoded)) return fallback;
    const url = new URL(target, 'https://local.invalid');
    return url.origin === 'https://local.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch { return fallback; }
}
