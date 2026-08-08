import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from './config.js';

const environment = {
  ARCH_REGISTER_URL: 'http://arch-register.test/',
  ARCH_REGISTER_WORKSPACE: 'workspace/one',
  ARCH_REGISTER_TOKEN: 'ar_pat_test',
  ARCH_REGISTER_WEBHOOK_SECRET: 'whsec_test'
};

test('reads required configuration and defaults', () => {
  const config = readConfig(environment);

  assert.equal(config.archRegisterUrl, 'http://arch-register.test');
  assert.equal(config.workspace, 'workspace/one');
  assert.equal(config.targetCapability, 'ws.settings');
  assert.equal(config.assignmentAction, 'approve');
  assert.equal(config.autoDecision, 'none');
});

test('validates decision and port configuration', () => {
  assert.throws(() => readConfig({ ...environment, AUTO_DECISION: 'escalate' }), /AUTO_DECISION/);
  assert.throws(() => readConfig({ ...environment, PORT: '0' }), /PORT/);
});
