import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifySignature } from './server.js';

test('verifies Arch Register webhook signatures against the raw body', () => {
  const body = Buffer.from('{"id":"event-1"}');
  const secret = 'whsec_test';
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  assert.equal(verifySignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifySignature(body, `sha256=${'0'.repeat(64)}`, secret), false);
  assert.equal(verifySignature(body, signature, secret), false);
});
