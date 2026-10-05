import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireProjectDeleteCredentials } from '../lib/project-delete-auth.ts';

const original = { ...process.env };
beforeEach(() => {
  process.env.CANOPY_DELETE_USERNAME = 'test-admin';
  process.env.CANOPY_DELETE_PASSWORD = 'test-secret';
});
afterEach(() => {
  for (const key of ['CANOPY_DELETE_USERNAME', 'CANOPY_DELETE_PASSWORD']) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});
const request = (body) => new Request('https://example.test/api/projects/test', {
  method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body),
});

test('requires both configured credentials and fails closed', async () => {
  for (const key of ['CANOPY_DELETE_USERNAME', 'CANOPY_DELETE_PASSWORD']) {
    const value = process.env[key];
    delete process.env[key];
    const response = await requireProjectDeleteCredentials(request({ username: 'test-admin', password: 'test-secret' }));
    assert.equal(response.status, 503);
    process.env[key] = value;
  }
});

test('rejects absent, malformed, incorrect, and oversized credentials', async () => {
  const invalid = [undefined, null, [], {}, { username: 'test-admin' },
    { username: 'wrong', password: 'test-secret' },
    { username: 'test-admin', password: 'wrong' },
    { username: 'test-admin', password: ['test-secret'] },
    { username: 'x'.repeat(101), password: 'test-secret' },
    { username: 'test-admin', password: 'x'.repeat(257) }];
  for (const body of invalid) {
    const response = await requireProjectDeleteCredentials(request(body));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Incorrect username or password.' });
  }
  const malformed = new Request('https://example.test', { method: 'DELETE', body: '{' });
  assert.equal((await requireProjectDeleteCredentials(malformed)).status, 401);
});

test('accepts only the configured username and password together', async () => {
  assert.equal(await requireProjectDeleteCredentials(request({ username: 'test-admin', password: 'test-secret' })), null);
});
