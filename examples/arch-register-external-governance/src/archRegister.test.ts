import assert from 'node:assert/strict';
import test from 'node:test';
import { ArchRegisterClient } from './archRegister.js';

const config = {
  host: '127.0.0.1',
  port: 3070,
  archRegisterUrl: 'http://arch-register.test',
  workspace: 'workspace/one',
  archRegisterToken: 'ar_pat_test',
  webhookSecret: 'whsec_test',
  targetCapability: 'ws.settings',
  assignmentAction: 'approve' as const,
  autoDecision: 'none' as const,
  decisionReason: 'Reviewed by the external governance engine'
};

test('calls the integration governance endpoints with bearer authentication', async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return new Response(
      JSON.stringify(
        requests.length === 1
          ? { assignment: { id: 'assignment-1' }, case: { id: 'case-1' } }
          : { case: { id: 'case-1' }, event: { id: 'event-1', eventType: 'approved' } }
      ),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };
  const client = new ArchRegisterClient(config, fetchImpl);

  await client.createInboxItem('case-1', 'ws.settings', 'approve', 'inbox-key');
  await client.decideInboxItem('assignment-1', 'approve', 'Looks good', 'decision-key');

  assert.deepEqual(
    requests.map(request => request.url),
    [
      'http://arch-register.test/api/integrations/v1/workspace%2Fone/governance/cases/case-1/inbox-items',
      'http://arch-register.test/api/integrations/v1/workspace%2Fone/governance/inbox-items/assignment-1/decisions'
    ]
  );
  assert.equal(new Headers(requests[0]?.init.headers).get('authorization'), 'Bearer ar_pat_test');
  assert.deepEqual(JSON.parse(String(requests[0]?.init.body)), {
    action: 'approve',
    target: { type: 'capability', capability: 'ws.settings' },
    idempotencyKey: 'inbox-key'
  });
  assert.deepEqual(JSON.parse(String(requests[1]?.init.body)), {
    decision: 'approve',
    reason: 'Looks good',
    idempotencyKey: 'decision-key'
  });
});
