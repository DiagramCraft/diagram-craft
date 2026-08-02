import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';
import type { AutomationRuleEvent } from './automationRuleEvaluation';
import { createAutomationRuleExecutionHandler } from './automationRuleExecution';
import { buildUserAuthCtx } from '../auth/authorization';

vi.mock('../auth/authorization', () => ({
  buildUserAuthCtx: vi.fn()
}));

const rule: AutomationRuleDbResult = {
  id: 'rule-1',
  workspace: 'ws-1',
  created_by: 'user-1',
  name: 'Set salary',
  description: null,
  schema_id: 'schema-1',
  trigger: { kind: 'entity_created' },
  conditions: [],
  actions: [{ kind: 'set_field_value', field: 'salary', value: 100000 }],
  enabled: true,
  created_at: new Date(),
  updated_at: new Date()
};

const event: AutomationRuleEvent = {
  version: '1',
  auditLogId: 'audit-1',
  workspace: 'ws-1',
  operation: 'create',
  entityId: 'entity-1',
  entityName: 'Person',
  entitySlug: 'person',
  schemaId: 'schema-1',
  actor: { id: 'user-2', displayName: 'Ada' },
  occurredAt: new Date().toISOString(),
  changes: { new: { title: 'Person' } }
};

describe('automation rule execution authorization', () => {
  it('skips queued actions after the owner loses field-group access', async () => {
    vi.mocked(buildUserAuthCtx).mockResolvedValue(
      buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: null,
        workspaceRoles: [],
        teamAssignments: [],
        schemas: [],
        entities: [],
        grants: []
      })
    );
    const updateEntity = vi.fn();
    const db = {
      automationRule: { getRule: vi.fn(async () => rule) },
      catalog: {
        getSchema: vi.fn(async () => ({
          fields: [{ id: 'salary', name: 'Salary', type: 'number', groupId: 'restricted' }],
          groups: [
            { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['finance'] } }
          ]
        })),
        getEntity: vi.fn(),
        updateEntity
      }
    } as unknown as DatabaseAdapter;

    const result = await createAutomationRuleExecutionHandler(db)({
      jobId: 'job-1',
      workspace: 'ws-1',
      payload: { ruleId: rule.id, automationRuleChain: [rule.id], event }
    });

    expect(result).toEqual({ skipped: true, reason: 'rule-owner-no-longer-authorized' });
    expect(updateEntity).not.toHaveBeenCalled();
  });
});
