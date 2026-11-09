import http from 'node:http';
import https from 'node:https';

// Presigned S3 (SigV4) signatures cover the Host header and the exact path/query.
// fetch() silently drops a `host` override, so the request is replayed with
// node:http, which preserves it. Nothing here is attacker-controlled: the
// upstream origin is server-configured and the bucket prefix is fixed.
const FORWARDED = ['content-type', 'content-length', 'content-md5', 'if-none-match', 'if-match', 'range', 'x-amz-acl', 'x-amz-content-sha256', 'x-amz-date'];

export function s3ProxyRequest(request, path, configuredOrigin, publicHost, bucket) {
  let upstream;
  try {
    upstream = new URL(configuredOrigin);
    if (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password ||
        upstream.search || upstream.hash || upstream.pathname !== '/') throw new Error();
  } catch {
    return Promise.resolve(Response.json({ message: 'Storage destination is not configured' }, { status: 503 }));
  }
  if (!publicHost) return Promise.resolve(Response.json({ message: 'Storage host is not configured' }, { status: 503 }));
  if (!Array.isArray(path) || path.length === 0) return Promise.resolve(Response.json({ message: 'Invalid object path' }, { status: 400 }));
  for (const part of path) {
    let decoded = part;
    try {
      for (let depth = 0; depth < 4; depth++) {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      }
    } catch { return Promise.resolve(Response.json({ message: 'Invalid object path' }, { status: 400 })); }
    if (!decoded || decoded === '.' || decoded === '..' || /[\\\x00-\x1f\x7f]/.test(decoded)) {
      return Promise.resolve(Response.json({ message: 'Invalid object path' }, { status: 400 }));
    }
  }
  if (!['GET', 'HEAD', 'PUT'].includes(request.method)) {
    return Promise.resolve(Response.json({ message: 'Method not allowed' }, { status: 405 }));
  }
  const search = new URL(request.url).search;
  // Only signed, expiring URLs are proxied; unsigned object access is refused here.
  if (!/[?&]X-Amz-Signature=/.test(search)) {
    return Promise.resolve(Response.json({ message: 'A signed storage URL is required' }, { status: 403 }));
  }

  const headers = { host: publicHost };
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  const client = upstream.protocol === 'https:' ? https : http;
  const objectPath = `/${bucket}/${path.map(encodeURIComponent).join('/')}`;

  return new Promise((resolve) => {
    const proxied = client.request({
      protocol: upstream.protocol, hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
      path: objectPath + search, method: request.method, headers,
    }, (upstreamResponse) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (['connection', 'keep-alive', 'transfer-encoding', 'set-cookie'].includes(name)) continue;
        responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value));
      }
      responseHeaders.set('cache-control', 'no-store');
      const body = request.method === 'HEAD' ? null
        : new ReadableStream({
            start(controller) {
              upstreamResponse.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
              upstreamResponse.on('end', () => controller.close());
              upstreamResponse.on('error', () => { try { controller.close(); } catch {} });
            },
          });
      resolve(new Response(body, { status: upstreamResponse.statusCode, headers: responseHeaders }));
    });

    proxied.on('error', () => resolve(Response.json({ message: 'Storage is temporarily unavailable' }, { status: 502 })));

    if (request.body) {
      const reader = request.body.getReader();
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { proxied.end(); return; }
        proxied.write(Buffer.from(value));
        pump();
      }).catch(() => proxied.destroy());
      pump();
    } else {
      proxied.end();
    }
  });
}
