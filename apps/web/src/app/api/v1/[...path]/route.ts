import { proxyRequest } from '@/lib/api-proxy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const destination = process.env.API_GATEWAY_INTERNAL_URL ||
    (process.env.API_GATEWAY_HOSTPORT ? `http://${process.env.API_GATEWAY_HOSTPORT}` : undefined);
  return proxyRequest(request, path, destination);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as HEAD, handle as OPTIONS };
