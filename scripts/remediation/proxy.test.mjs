import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { proxyRequest } from '../../apps/web/src/lib/api-proxy.mjs';

let server, origin, hits = 0;
before(async () => {
  server = createServer(async (req, res) => {
    hits++;
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.url.includes('/redirect')) { res.writeHead(302, { location: 'https://outside.invalid/' }); res.end(); return; }
    res.writeHead(201, { 'content-type': 'application/json', 'set-cookie': ['first=1; HttpOnly', 'second=2; HttpOnly'] });
    res.end(JSON.stringify({ path: req.url, method: req.method, body, authorization: req.headers.authorization, cookie: req.headers.cookie, forwarded: req.headers['x-forwarded-for'] }));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });

test('runtime destination forwards path, query, body, credentials, status and cookies', async () => {
  const request = new Request('https://frontend.invalid/api/v1/auth/login?source=fixture', {
    method: 'POST', headers: { authorization: 'Bearer fixture', cookie: 'fixture=1', 'x-forwarded-for': 'attacker' }, body: '{"fixture":true}',
  });
  const response = await proxyRequest(request, ['auth', 'login'], origin);
  assert.equal(response.status, 201);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { path: '/api/v1/auth/login?source=fixture', method: 'POST', body: '{"fixture":true}', authorization: 'Bearer fixture', cookie: 'fixture=1' });
});
test('does not follow redirects to another host', async () => {
  const response = await proxyRequest(new Request('https://frontend.invalid/api/v1/redirect'), ['redirect'], origin);
  assert.equal(response.status, 302);
});
test('rejects traversal and missing or unsafe destination without upstream requests', async () => {
  const previousHits = hits;
  for (const path of [['..'], ['%252e%252e'], ['%2fadmin'], ['https:'], ['\\admin'], ['%00'], []]) {
    assert.equal((await proxyRequest(new Request('https://frontend.invalid/'), path, origin)).status, 400);
  }
  for (const destination of [undefined, 'file:///etc/passwd', 'https://user:pass@api.invalid', `${origin}/unexpected`]) {
    assert.equal((await proxyRequest(new Request('https://frontend.invalid/'), ['auth'], destination)).status, 503);
  }
  assert.equal(hits, previousHits);
});
