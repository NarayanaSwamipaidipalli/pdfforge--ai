// Full production-image pipeline using newly created, labeled resources only.
// Never loads .env, normal Compose services, existing records, or development volumes.
import { randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, readRun, root, testEnv } from './isolated.mjs';

const run = readRun();
const suffix = randomBytes(4).toString('hex');
const prefix = `${run.project}-pipeline-${suffix}`;
const database = `security_pipeline_${suffix}`;
const names = Object.fromEntries(['redis', 'minio', 'api', 'worker', 'celery', 'migrate', 'bootstrap', 'runner', 'validate']
  .map(kind => [kind, `${prefix}-${kind}`]));
const label = `pdfforge.remediation.run=${run.project}`;
const evidence = resolve(root, '.remediation', `pipeline-${suffix}`);
const fixture = resolve(root, '.remediation/conversion/image-table-fixture.docx');
const apiImage = `${run.project}-api:verification`;
const workerImage = `${run.project}-worker:verification`;
const bucket = `pipeline-${suffix}`;
const redisPassword = randomBytes(32).toString('hex');
const storageAccess = `pipeline${suffix}`;
const storageSecret = randomBytes(32).toString('hex');
const env = {
  ...testEnv(run), NODE_ENV: 'production', ENVIRONMENT: 'production', LOAD_LOCAL_ENV: 'false',
  DATABASE_URL: `postgresql://${run.dbUser}:${encodeURIComponent(run.dbPassword)}@${run.postgres}:5432/${database}?schema=public`,
  EXPECTED_DB_HOST: run.postgres, EXPECTED_DB_NAME: database,
  EXPECTED_API_HOST: names.api, EXPECTED_WORKER_HOST: names.worker, EXPECTED_S3_HOST: names.minio,
  PIPELINE_API_URL: `http://${names.api}:4000`, PDF_WORKER_URL: `http://${names.worker}:8000`,
  API_GATEWAY_INTERNAL_URL: `http://${names.api}:4000`,
  REDIS_URL: `redis://:${redisPassword}@${names.redis}:6379/0`,
  CELERY_BROKER_URL: `redis://:${redisPassword}@${names.redis}:6379/0`,
  CELERY_RESULT_BACKEND: `redis://:${redisPassword}@${names.redis}:6379/1`,
  S3_ENDPOINT: `http://${names.minio}:9000`, S3_PUBLIC_ENDPOINT: `http://${names.minio}:9000`,
  S3_BUCKET_NAME: bucket, S3_AUTO_CREATE_BUCKET: 'false',
  AWS_ACCESS_KEY_ID: storageAccess, AWS_SECRET_ACCESS_KEY: storageSecret,
  FRONTEND_URL: 'https://pipeline.example.invalid', CORS_ORIGINS: 'https://pipeline.example.invalid',
  ENABLE_STRIPE: 'false', ENABLE_RAZORPAY: 'false', ENABLE_PAYPAL: 'false',
};

function withEnv(args, injected) {
  for (const key of Object.keys(injected)) args.push('--env', key);
  return args;
}
function containerArgs(name, detached = false) {
  return ['run', ...(detached ? ['-d'] : []), '--pull=never', '--name', name,
    '--network', run.network, '--label', label];
}
function ownedImage(image) {
  const owner = command('docker', ['image', 'inspect', '--format', '{{index .Config.Labels "pdfforge.remediation.run"}}', image]);
  if (owner !== run.project) throw new Error('Production image ownership check failed');
  return command('docker', ['image', 'inspect', '--format', '{{.Id}}', image]);
}
function requireUnused(kind, name) {
  let present = false;
  try { command('docker', [kind, 'inspect', name]); present = true; } catch { /* Creation will also fail if Docker is unavailable. */ }
  if (present) throw new Error('A proposed isolated resource already exists; refusing reuse');
}

try {
  const networkOwner = command('docker', ['network', 'inspect', '--format', '{{index .Labels "pdfforge.remediation.run"}}', run.network]);
  const internal = command('docker', ['network', 'inspect', '--format', '{{.Internal}}', run.network]);
  if (networkOwner !== run.project || internal !== 'true') throw new Error('Isolated internal network ownership check failed');
  if (!existsSync(fixture) || !lstatSync(fixture).isFile() || lstatSync(fixture).isSymbolicLink()) {
    throw new Error('Run the worker-image tests first to create the image/table DOCX fixture');
  }
  const images = { api: ownedImage(apiImage), worker: ownedImage(workerImage),
    // Resolve local images to immutable IDs. No registry pull or existing container inspection occurs.
    redis: command('docker', ['image', 'inspect', '--format', '{{.Id}}', process.env.PDFFORGE_PIPELINE_REDIS_IMAGE || 'redis:7.4-alpine']),
    minio: command('docker', ['image', 'inspect', '--format', '{{.Id}}', process.env.PDFFORGE_PIPELINE_MINIO_IMAGE || 'cgr.dev/chainguard/minio:latest']),
  };
  mkdirSync(evidence, { recursive: true });
  writeFileSync(resolve(evidence, 'resources.json'), JSON.stringify({ project: run.project, database, names,
    network: run.network, images, bucket, createdAt: new Date().toISOString() }, null, 2), { flag: 'wx', mode: 0o600 });

  const redisVolume = `${prefix}-redis-data`, minioVolume = `${prefix}-minio-data`;
  for (const name of Object.values(names)) requireUnused('container', name);
  for (const name of [redisVolume, minioVolume]) requireUnused('volume', name);
  for (const volume of [redisVolume, minioVolume]) command('docker', ['volume', 'create', '--label', label, volume]);
  command('docker', [...withEnv([...containerArgs(names.redis, true),
    '--mount', `type=volume,source=${redisVolume},target=/data`], { REDIS_PASSWORD: redisPassword }),
    images.redis, 'sh', '-c', 'exec redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"'], { REDIS_PASSWORD: redisPassword });
  command('docker', [...withEnv([...containerArgs(names.minio, true), '--user', '0:0',
    '--mount', `type=volume,source=${minioVolume},target=/data`], {
    MINIO_ROOT_USER: storageAccess, MINIO_ROOT_PASSWORD: storageSecret }),
    images.minio, 'server', '/data', '--address', ':9000', '--console-address', ':9001'], {
    MINIO_ROOT_USER: storageAccess, MINIO_ROOT_PASSWORD: storageSecret });

  command('docker', ['exec', run.postgres, 'createdb', '-U', run.dbUser, database]);
  command('docker', [...withEnv(containerArgs(names.migrate), { DATABASE_URL: env.DATABASE_URL }),
    '--entrypoint', 'node', images.api, '/app/node_modules/prisma/build/index.js', 'migrate', 'deploy',
    '--schema', '/app/prisma/schema.prisma'], { DATABASE_URL: env.DATABASE_URL });

  const bootstrap = String.raw`
import os, time
from urllib.parse import urlsplit
import boto3, redis
from botocore.config import Config
assert urlsplit(os.environ['S3_ENDPOINT']).hostname == os.environ['EXPECTED_S3_HOST']
s3 = boto3.client('s3', endpoint_url=os.environ['S3_ENDPOINT'], region_name='us-east-1',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    config=Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1}))
broker = redis.Redis.from_url(os.environ['REDIS_URL'], socket_connect_timeout=2, socket_timeout=2)
for attempt in range(60):
    try:
        broker.ping()
        s3.list_buckets()
        break
    except Exception:
        if attempt == 59: raise RuntimeError('Isolated storage/broker readiness failed') from None
        time.sleep(1)
s3.create_bucket(Bucket=os.environ['S3_BUCKET_NAME'])
print('PASS: isolated authenticated Redis and S3 bucket are ready')
`;
  command('docker', [...withEnv(containerArgs(names.bootstrap), env), '--entrypoint', 'python', images.worker, '-c', bootstrap], env,
    { timeout: 150_000 });

  command('docker', [...withEnv(containerArgs(names.worker, true), { ...env, PORT: '8000' }), images.worker], { ...env, PORT: '8000' });
  command('docker', [...withEnv(containerArgs(names.celery, true), env), images.worker,
    'celery', '-A', 'app.celery_app.celery_app', 'worker', '--loglevel=warning', '--concurrency=1', '--max-tasks-per-child=5'], env);
  command('docker', [...withEnv(containerArgs(names.api, true), { ...env, PORT: '4000' }), images.api], { ...env, PORT: '4000' });

  const output = command('docker', [...withEnv([...containerArgs(names.runner),
    '--mount', `type=bind,source=${resolve(root, 'scripts/remediation/pipeline-integration.cjs')},target=/verification/pipeline-integration.cjs,readonly`,
    '--mount', `type=bind,source=${fixture},target=/verification/input.docx,readonly`], env),
    '--entrypoint', 'node', images.api, '/verification/pipeline-integration.cjs'], env, { timeout: 360_000 });
  writeFileSync(resolve(evidence, 'http-results.txt'), output, { mode: 0o600 });
  command('docker', ['cp', `${names.runner}:/tmp/pipeline-result.pdf`, resolve(evidence, 'pipeline-result.pdf')]);

  const validate = String.raw`
import json, pymupdf
with pymupdf.open('/verification/result.pdf') as pdf:
    text = '\n'.join(page.get_text(sort=True) for page in pdf)
    sentinels = ['BEFORE_TABLE_fixture', 'TABLE_CELL_fixture', 'AFTER_TABLE_fixture', 'AFTER_IMAGE_fixture', '125.50']
    assert pdf.page_count >= 1, 'Output has no pages'
    assert all(value in text for value in sentinels), 'Image/table document text was lost'
    assert text.index(sentinels[0]) < text.index(sentinels[1]) < text.index(sentinels[2]), 'Document reading order changed'
    images = sum(len(page.get_images()) for page in pdf)
    drawings = sum(len(page.get_drawings()) for page in pdf)
    assert images >= 1, 'Embedded image was lost'
    assert drawings >= 1, 'Table borders were lost'
    pdf[0].get_pixmap(dpi=120).save('/tmp/pipeline-result.png')
    print(json.dumps({'result': 'PASS', 'pages': pdf.page_count, 'images': images, 'drawings': drawings,
        'tableTextAndOrder': True, 'realS3CeleryApiCallback': True}))
`;
  const validation = command('docker', [...containerArgs(names.validate),
    '--mount', `type=bind,source=${resolve(evidence, 'pipeline-result.pdf')},target=/verification/result.pdf,readonly`,
    '--env', 'ENVIRONMENT=test', '--entrypoint', 'python', images.worker, '-c', validate], {}, { timeout: 60_000 });
  writeFileSync(resolve(evidence, 'pdf-validation.json'), validation);
  command('docker', ['cp', `${names.validate}:/tmp/pipeline-result.png`, resolve(evidence, 'pipeline-result.png')]);
  console.log(output);
  console.log(`PASS: production pipeline PDF validation ${validation}`);
  console.log(`Evidence: .remediation/pipeline-${suffix}; all isolated containers, volumes and database retained.`);
} catch (error) {
  mkdirSync(evidence, { recursive: true });
  if (error.detail) writeFileSync(resolve(evidence, 'error-private.txt'), error.detail, { mode: 0o600 });
  console.error(`Pipeline verification failed: ${error.message}. Isolated resources retained; private diagnostics saved.`);
  process.exitCode = 1;
}
