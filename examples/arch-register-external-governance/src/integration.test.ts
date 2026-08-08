import assert from 'node:assert/strict';
import test from 'node:test';
import type { Config } from './config.js';
import { processWebhookEvent, type GovernanceWebhookEvent } from './integration.js';

const event: GovernanceWebhookEvent = {
  version: '1',
  id: 'event-1',
  type: 'governance.workflow.started',
  operation: 'governance.workflow.started',
  occurred_at: '2026-08-08T10:00:00Z',
  workspace_id: 'default',
  governance: {
    case: {
      id: 'case-1',
      kind: 'assessment.response',
      subject_type: 'assessment',
      subject_id: 'assessment-1',
      status: 'open',
      outcome: null,
      external: true,
      initiation_fields: []
    },
    event: { id: 'event-1', event_type: 'submitted' },
    assignment_id: null
  }
};

const config = (autoDecision: Config['autoDecision']): Config => ({
  host: '127.0.0.1',
  port: 3070,
  archRegisterUrl: 'http://arch-register.test',
  workspace: 'default',
  archRegisterToken: 'ar_pat_test',
  webhookSecret: 'whsec_test',
  targetCapability: 'ws.settings',
  assignmentAction: 'approve',
  autoDecision,
  decisionReason: 'External policy review'
});

test('creates an inbox item with an event-derived idempotency key', async () => {
  const calls: string[] = [];
  const client = {
    createInboxItem: async (...args: unknown[]) => {
      calls.push(JSON.stringify(args));
      return { assignment: { id: 'assignment-1' }, case: { id: 'case-1' } };
    },
    decideInboxItem: async () => {
      throw new Error('decision should not be submitted');
    }
  } as never;

  const result = await processWebhookEvent(event, config('none'), client);

  assert.deepEqual(result, {
    status: 'created',
    caseId: 'case-1',
    assignmentId: 'assignment-1'
  });
  assert.deepEqual(JSON.parse(calls[0]!), [
    'case-1',
    'ws.settings',
    'approve',
    'external-governance:inbox:event-1'
  ]);
});

test('supports approve, reject, and request-changes decisions', async () => {
  for (const decision of ['approve', 'reject', 'request_changes'] as const) {
    let received: unknown[] | undefined;
    const client = {
      createInboxItem: async () => ({
        assignment: { id: `assignment-${decision}` },
        case: { id: 'case-1' }
      }),
      decideInboxItem: async (...args: unknown[]) => {
        received = args;
        return { case: { id: 'case-1' }, event: { id: 'event-2', eventType: decision } };
      }
    } as never;

    const result = await processWebhookEvent(event, config(decision), client);

    assert.equal(result.status, 'decided');
    assert.equal(result.decision, decision);
    assert.deepEqual(received, [
      `assignment-${decision}`,
      decision,
      'External policy review',
      `external-governance:decision:event-1:${decision}`
    ]);
  }
});

test('ignores cases that are not configured as external', async () => {
  let callCount = 0;
  const client = {
    createInboxItem: async () => {
      callCount += 1;
      return { assignment: { id: 'assignment-1' }, case: { id: 'case-1' } };
    }
  } as never;

  await processWebhookEvent(
    { ...event, governance: { ...event.governance, case: { ...event.governance.case, external: false } } },
    config('none'),
    client
  );

  assert.equal(callCount, 0);
});
