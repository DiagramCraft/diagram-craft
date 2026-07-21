import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';
import type { AutomationRuleEvent } from './automationRuleEvaluation';
import { AUTOMATION_RULE_SYSTEM_ACTOR, runAutomationAction } from './automationActionHandlers';

const adminAuthCtx: AuthorizationContext = {
  userId: 'user-2',
  globalRoles: new Set(),
  globalPermissions: new Set(['admin_platform']),
  workspaceRole: null,
  workspaceRoles: new Map(),
  teamIds: new Set(),
  teamAssignments: [],
  teams: [],
  teamRolesByTeam: new Map(),
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

vi.mock('../auth/authorization', () => ({
  buildUserAuthCtx: vi.fn(async () => adminAuthCtx)
}));

const rule: AutomationRuleDbResult = {
  id: 'rule-1',
  workspace: 'ws-1',
  name: 'Flag deprecated',
  description: null,
  schema_id: null,
  trigger: { kind: 'lifecycle_transition', to: 'Deprecated' },
  conditions: [],
  actions: [],
  enabled: true,
  created_at: new Date(),
  updated_at: new Date()
};

const event: AutomationRuleEvent = {
  version: '1',
  auditLogId: 'audit-1',
  workspace: 'ws-1',
  operation: 'update',
  entityId: 'entity-1',
  entityName: 'Payments',
  entitySlug: 'payments',
  schemaId: 'schema-1',
  actor: { id: 'user-1', displayName: 'Ada' },
  occurredAt: new Date('2026-07-15T10:00:00.000Z').toISOString(),
  changes: { old: { _lifecycle: 'Production' }, new: { _lifecycle: 'Deprecated' } },
  fieldValues: { _lifecycle: 'Deprecated' }
};

describe('create_audit_note action', () => {
  it('writes an automation_note audit row directly, not through writeAudit', async () => {
    const createAuditLog = vi.fn(async input => ({ ...input, id: 'note-1' }));
    const db = { audit: { createAuditLog } } as unknown as DatabaseAdapter;

    await runAutomationAction({
      db,
      rule,
      action: { kind: 'create_audit_note', note: 'Please review' },
      event,
      chain: ['rule-1']
    });

    expect(createAuditLog).toHaveBeenCalledOnce();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'automation_note',
        entity_id: 'entity-1',
        changes: { new: { note: 'Please review' } },
        metadata: expect.objectContaining({ ruleId: 'rule-1', note: 'Please review' })
      })
    );
  });
});

describe('send_notification action', () => {
  it('does nothing when the entity cannot be found', async () => {
    const createNotification = vi.fn();
    const db = {
      notification: { createNotification },
      catalog: { getEntity: vi.fn(async () => null) }
    } as unknown as DatabaseAdapter;

    await runAutomationAction({
      db,
      rule,
      action: { kind: 'send_notification', recipient: { kind: 'owner_team' }, message: 'hi' },
      event,
      chain: []
    });

    expect(createNotification).not.toHaveBeenCalled();
  });

  it('notifies a specific user when they can view the entity', async () => {
    const entity = {
      id: 'entity-1',
      public_id: 'pub-1',
      name: 'Payments',
      owner: null,
      workspace: 'ws-1',
      visibility_mode: null,
      data: {}
    };
    const createNotification = vi.fn(async input => input);
    const db = {
      notification: { createNotification },
      catalog: { getEntity: vi.fn(async () => entity) },
      notificationPreference: { listOverrides: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;

    await runAutomationAction({
      db,
      rule,
      action: {
        kind: 'send_notification',
        recipient: { kind: 'user', userId: 'user-2' },
        message: 'Deprecated entity needs review'
      },
      event,
      chain: []
    });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-2',
        message: 'Deprecated entity needs review',
        delivery_key: `automation-rule:rule-1:audit-1:user:user-2`
      })
    );
  });
});

describe('set_field_value action', () => {
  it('threads the automation rule chain into the resulting entity update', async () => {
    const entity = {
      id: 'entity-1',
      workspace: 'ws-1',
      slug: 'payments',
      namespace: null,
      name: 'Payments',
      description: null,
      owner: null,
      lifecycle: 'Deprecated',
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: { notes: 'old' },
      visibility_mode: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    const schema = {
      id: 'schema-1',
      workspace: 'ws-1',
      fields: [{ id: 'notes', name: 'Notes', type: 'text' }]
    };
    const updateEntity = vi.fn(async () => ({ ...entity, data: { notes: 'reviewed' } }));
    const createAuditLog = vi.fn(async input => ({
      ...input,
      id: 'audit-2',
      user_display_name: null
    }));
    const db = {
      catalog: {
        getEntity: vi.fn(async () => entity),
        getSchema: vi.fn(async () => schema),
        updateEntity,
        createSnapshot: vi.fn(async () => undefined),
        pruneAutosaveSnapshots: vi.fn(async () => undefined)
      },
      audit: { createAuditLog },
      watch: { createNotificationsFromAudit: vi.fn(async () => undefined) }
    } as unknown as DatabaseAdapter;

    await runAutomationAction({
      db,
      rule,
      action: { kind: 'set_field_value', field: 'notes', value: 'reviewed' },
      event,
      chain: ['rule-1']
    });

    expect(updateEntity).toHaveBeenCalledWith(
      'ws-1',
      'entity-1',
      expect.objectContaining({ data: { notes: 'reviewed' } })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ automationRuleChain: ['rule-1'] })
      })
    );
  });
});

describe('AUTOMATION_RULE_SYSTEM_ACTOR', () => {
  it('is a stable synthesized system actor', () => {
    expect(AUTOMATION_RULE_SYSTEM_ACTOR).toEqual({
      id: 'system:automation-rules',
      displayName: 'Automation rule'
    });
  });
});
