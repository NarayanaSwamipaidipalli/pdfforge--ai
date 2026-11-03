import test from 'node:test';
import assert from 'node:assert/strict';
import { safeLocalRedirect } from '../../apps/web/src/lib/safe-redirect.mjs';

test('preserves local dashboard paths and query parameters', () => {
  assert.equal(safeLocalRedirect('/dashboard?tab=files#recent'), '/dashboard?tab=files#recent');
  assert.equal(safeLocalRedirect('/account'), '/account');
});

test('rejects external origins, scripts, encoded authority separators and malformed input', () => {
  for (const target of [null, undefined, '', 'https://attacker.invalid', '//attacker.invalid',
    'javascript:alert(1)', '/\\attacker.invalid', '/%5cattacker.invalid', '/%2f%2fattacker.invalid',
    '/%252f%252fattacker.invalid', '/\n/attacker.invalid', '/%ZZ']) {
    assert.equal(safeLocalRedirect(target), '/dashboard');
  }
});
