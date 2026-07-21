import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuditLogDbResult } from '../audit/db/auditDatabase';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';
import {
  AUTOMATION_RULE_JOB_TYPE,
  AUTOMATION_RULE_MAX_CHAIN_LENGTH,
  enqueueAutomationRuleRuns
} from './automationRuleEvaluation';

const baseRule: AutomationRuleDbResult = {
  id: 'rule-1',
  workspace: 'ws-1',
  name: 'Flag deprecated entities',
  description: null,
  schema_id: null,
  trigger: { kind: 'lifecycle_transition', to: 'Deprecated' },
  conditions: [],
  actions: [{ kind: 'create_audit_note', note: 'Deprecated' }],
  enabled: true,
  created_at: new Date(),
  updated_at: new Date()
};

const baseAuditLog: AuditLogDbResult = {
  id: 'audit-1',
  workspace: 'ws-1',
  timestamp: new Date('2026-07-15T10:00:00.000Z'),
  user_id: 'user-1',
  user_display_name: 'Ada',
  operation: 'update',
  entity_type: 'entity',
  entity_id: 'entity-1',
  entity_name: 'Payments',
  entity_slug: 'payments',
  schema_id: 'schema-1',
  changes: { old: { _lifecycle: 'Production' }, new: { _lifecycle: 'Deprecated' } },
  metadata: {}
};

const makeDb = (rule: AutomationRuleDbResult, enqueueOneOffRun = vi.fn(async input => input)) =>
  ({
    automationRule: { listRules: vi.fn(async () => [rule]) },
    catalog: { getEntity: vi.fn(async () => null) },
    jobs: { enqueueOneOffRun }
  }) as unknown as DatabaseAdapter;

describe('enqueueAutomationRuleRuns', () => {
  it('enqueues a job run for a matching lifecycle_transition rule', async () => {
    const enqueueOneOffRun = vi.fn(async input => input);
    const db = makeDb(baseRule, enqueueOneOffRun);

    const count = await enqueueAutomationRuleRuns(db, baseAuditLog);

    expect(count).toBe(1);
    expect(enqueueOneOffRun).toHaveBeenCalledOnce();
    expect(enqueueOneOffRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: 'ws-1',
        job_type: AUTOMATION_RULE_JOB_TYPE,
        payload: expect.objectContaining({ ruleId: 'rule-1', automationRuleChain: ['rule-1'] })
      })
    );
  });

  it('does not enqueue a rule whose trigger does not match', async () => {
    const rule: AutomationRuleDbResult = {
      ...baseRule,
      trigger: { kind: 'entity_created' }
    };
    const db = makeDb(rule);

    expect(await enqueueAutomationRuleRuns(db, baseAuditLog)).toBe(0);
  });

  it('does not enqueue a disabled rule', async () => {
    const db = makeDb({ ...baseRule, enabled: false });
    expect(await enqueueAutomationRuleRuns(db, baseAuditLog)).toBe(0);
  });

  it('skips a rule whose conditions do not match', async () => {
    const rule: AutomationRuleDbResult = {
      ...baseRule,
      conditions: [{ field: '_owner', operator: 'is_not_empty' }]
    };
    const enqueueOneOffRun = vi.fn(async input => input);
    const db = {
      automationRule: { listRules: vi.fn(async () => [rule]) },
      catalog: { getEntity: vi.fn(async () => ({ owner: null, data: {} })) },
      jobs: { enqueueOneOffRun }
    } as unknown as DatabaseAdapter;

    expect(await enqueueAutomationRuleRuns(db, baseAuditLog)).toBe(0);
    expect(enqueueOneOffRun).not.toHaveBeenCalled();
  });

  it('does not re-enqueue a rule that already fired earlier in the chain (self-trigger guard)', async () => {
    const enqueueOneOffRun = vi.fn(async input => input);
    const db = makeDb(baseRule, enqueueOneOffRun);

    // Simulates a `set_field_value` action from this same rule re-entering writeAudit: the
    // chain already contains the rule's own id, so it must not be enqueued again — otherwise a
    // self-triggering rule (matches its own resulting update) would loop forever.
    const count = await enqueueAutomationRuleRuns(db, baseAuditLog, {
      automationRuleChain: ['rule-1']
    });

    expect(count).toBe(0);
    expect(enqueueOneOffRun).not.toHaveBeenCalled();
  });

  it('stops enqueueing once the chain reaches the max length, even for a different rule', async () => {
    const otherRule: AutomationRuleDbResult = { ...baseRule, id: 'rule-2' };
    const enqueueOneOffRun = vi.fn(async input => input);
    const db = makeDb(otherRule, enqueueOneOffRun);

    const longChain = Array.from({ length: AUTOMATION_RULE_MAX_CHAIN_LENGTH }, (_, i) => `r${i}`);
    const count = await enqueueAutomationRuleRuns(db, baseAuditLog, {
      automationRuleChain: longChain
    });

    expect(count).toBe(0);
    expect(enqueueOneOffRun).not.toHaveBeenCalled();
  });

  it('ignores non-entity audit rows entirely', async () => {
    const enqueueOneOffRun = vi.fn(async input => input);
    const db = makeDb(baseRule, enqueueOneOffRun);

    const count = await enqueueAutomationRuleRuns(db, {
      ...baseAuditLog,
      entity_type: 'project'
    });

    expect(count).toBe(0);
    expect(enqueueOneOffRun).not.toHaveBeenCalled();
  });
});
