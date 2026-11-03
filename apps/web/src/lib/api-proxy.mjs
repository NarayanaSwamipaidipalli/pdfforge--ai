const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host'];

function filteredHeaders(source) {
  const headers = new Headers(source);
  const nominated = (headers.get('connection') || '').split(',').map(name => name.trim()).filter(Boolean);
  for (const name of [...hopHeaders, ...nominated]) headers.delete(name);
  return headers;
}

/** A fixed, server-configured destination; no request parameter can select a host. */
export async function proxyRequest(request, path, configuredOrigin) {
  let destination;
  try {
    destination = new URL(configuredOrigin);
    if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password ||
        destination.search || destination.hash || !['/', '/api/v1', '/api/v1/'].includes(destination.pathname)) throw new Error();
  } catch {
    return Response.json({ message: 'API destination is not configured' }, { status: 503 });
  }
  if (!Array.isArray(path) || path.length === 0) return Response.json({ message: 'Invalid API path' }, { status: 400 });
  for (const part of path) {
    let decoded = part;
    try {
      for (let depth = 0; depth < 4; depth++) {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      }
    } catch { return Response.json({ message: 'Invalid API path' }, { status: 400 }); }
    if (!decoded || decoded === '.' || decoded === '..' || /[\\/\x00-\x20\x7f:]/.test(decoded)) {
      return Response.json({ message: 'Invalid API path' }, { status: 400 });
    }
  }
  destination.pathname = `/api/v1/${path.map(part => encodeURIComponent(part)).join('/')}`;
  destination.search = new URL(request.url).search;
  const headers = filteredHeaders(request.headers);
  // Never trust caller-supplied forwarding metadata for authentication or redirects.
  for (const name of [...headers.keys()]) if (name.toLowerCase().startsWith('x-forwarded-') || name === 'forwarded') headers.delete(name);
  const init = {
    method: request.method, headers, redirect: 'manual', cache: 'no-store', signal: request.signal,
    ...(!['GET', 'HEAD'].includes(request.method) ? { body: request.body, duplex: 'half' } : {}),
  };
  try {
    const upstream = await fetch(destination, init);
    const responseHeaders = filteredHeaders(upstream.headers);
    // fetch decompresses response bodies; these headers no longer describe the bytes.
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.set('cache-control', 'no-store');
    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) {
      responseHeaders.delete('set-cookie');
      for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ message: 'API is temporarily unavailable' }, { status: 502 });
  }
}
