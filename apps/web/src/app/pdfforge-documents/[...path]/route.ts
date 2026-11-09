import { s3ProxyRequest } from '@/lib/s3-proxy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serves presigned MinIO object URLs same-origin so remote browsers never
// need to reach the storage service directly. Only active when
// S3_PUBLIC_HOST is set, which happens for temporary public sharing.
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const bucket = process.env.S3_BUCKET_NAME || 'pdfforge-documents';
  return s3ProxyRequest(request, path, process.env.S3_INTERNAL_ENDPOINT, process.env.S3_PUBLIC_HOST, bucket);
}

export { handle as GET, handle as PUT, handle as HEAD };
