import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from 'node:util';
import { prepareComposeEnvironment, defaultMinioImage } from './prepare-env.mjs';
const prepare = source => prepareComposeEnvironment(source, parseEnv(source));

function fixture(extra = '') {
  return `POSTGRES_USER=fixture_user\nPOSTGRES_DB=fixture_database\nPOSTGRES_PASSWORD="reserved:@/#%$'password"\nMINIO_ROOT_USER=fixture_storage\nMINIO_ROOT_PASSWORD=fixture-storage-password\nJWT_SECRET=${'a'.repeat(48)}\nJWT_REFRESH_SECRET=${'b'.repeat(48)}\nWORKER_CALLBACK_SECRET=${'c'.repeat(48)}\n${extra}`;
}

test('preserves every credential and URL-encodes PostgreSQL reserved characters', () => {
  const before = parseEnv(fixture());
  const after = parseEnv(prepare(fixture()));
  for (const [key, value] of Object.entries(before)) assert.equal(after[key], value);
  const url = new URL(after.COMPOSE_DATABASE_URL);
  assert.equal(decodeURIComponent(url.password), before.POSTGRES_PASSWORD);
  assert.equal(url.hostname, 'postgres');
  assert.equal(url.pathname, '/fixture_database');
  assert.equal(after.MINIO_IMAGE, defaultMinioImage);
});

test('preserves explicit image choice and unrelated native database URL, and is repeatable', () => {
  const source = fixture('MINIO_IMAGE=registry.example.invalid/storage:approved\nDATABASE_URL=postgresql://native.invalid/native\n');
  const prepared = prepare(source);
  const values = parseEnv(prepared);
  assert.equal(values.MINIO_IMAGE, 'registry.example.invalid/storage:approved');
  assert.equal(values.DATABASE_URL, 'postgresql://native.invalid/native');
  assert.equal(prepare(prepared), prepared);
});

test('fails without creating or rotating missing credentials and does not reveal supplied values', () => {
  const password = 'private-fixture-value';
  assert.throws(() => prepare(`POSTGRES_PASSWORD=${password}\n`), error =>
    error.message.includes('JWT_SECRET') && !error.message.includes(password));
});

test('rejects startup-invalid reused or weak secrets without changing input', () => {
  assert.throws(() => prepare(fixture().replace('b'.repeat(48), 'a'.repeat(48))), /different/);
  assert.throws(() => prepare(fixture().replace('a'.repeat(48), 'short')), /JWT_SECRET/);
});

test('cannot accidentally derive credentials using a different dotenv parser', () => {
  assert.throws(() => prepareComposeEnvironment(fixture()), /Docker Compose/);
});
