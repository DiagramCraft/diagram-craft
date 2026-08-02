import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { WorkspaceRoleDefinition } from '@arch-register/permissions';
import type { AutomationRuleInput } from '@arch-register/api-types/automationRuleContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';
import { createAutomationRule, updateAutomationRule } from './automationRuleOperations';

const authorizationMocks = vi.hoisted(() => ({
  buildApiAuthCtx: vi.fn()
}));

vi.mock('../auth/authorization', async () => ({
  ...(await vi.importActual<typeof import('../auth/authorization')>('../auth/authorization')),
  buildApiAuthCtx: authorizationMocks.buildApiAuthCtx
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const now = new Date('2026-07-31T12:00:00.000Z');

// A role holding only `people.role` — enough to pass `requireWorkspaceAdmin` but deliberately
// short of `hasFieldGroupAdminBypass`'s `ws.settings` + `schema.edit` + `ent.edit`.
const peopleManagerRole: WorkspaceRoleDefinition = {
  id: 'people-manager',
  name: 'People manager',
  description: '',
  tone: '',
  builtin: false,
  capabilities: ['people.role']
};

const eventFor = (
  role: WorkspaceRoleDefinition,
  teamAssignments: { teamId: string; role: 'team_reviewer' | 'team_editor' | 'team_admin' }[] = []
) => {
  const authCtx = buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: role.id,
    workspaceRoles: [role],
    teamAssignments,
    schemas: [],
    entities: [],
    grants: []
  });
  authorizationMocks.buildApiAuthCtx.mockResolvedValueOnce(authCtx);
  return {} as AuthenticatedEvent;
};

const restrictedSchema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Person',
  description: '',
  fields: [
    { id: 'title', name: 'Title', type: 'text' },
    { id: 'salary', name: 'Salary', type: 'number', groupId: 'restricted' }
  ],
  groups: [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
  ],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'PER',
  created_at: now,
  updated_at: now
} as never;

const makeDb = (existingRule?: AutomationRuleDbResult) =>
  ({
    catalog: {
      getSchema: vi.fn(async () => restrictedSchema),
      listSchemas: vi.fn(async () => [restrictedSchema])
    },
    automationRule: {
      getRule: vi.fn(async () => existingRule ?? null),
      createRule: vi.fn(async input => ({ ...input })),
      updateRule: vi.fn(async (_ws, _id, input) => ({
        ...(existingRule ?? {}),
        ...input,
        id: existingRule?.id ?? 'rule-1'
      }))
    }
  }) as unknown as DatabaseAdapter;

const baseInput: AutomationRuleInput = {
  name: 'Flag high earners',
  description: null,
  schema_id: 'schema-1',
  trigger: { kind: 'entity_created' },
  conditions: [{ field: 'salary', operator: 'equals', value: 100000 }],
  actions: [{ kind: 'set_field_value', field: 'title', value: 'flagged' }],
  enabled: true
};

describe('createAutomationRule', () => {
  it('rejects a condition referencing a field the author cannot view', async () => {
    const db = makeDb();
    await expect(
      createAutomationRule(db, 'ws-1', baseInput, eventFor(peopleManagerRole))
    ).rejects.toThrow('restricted field');
    expect(db.automationRule.createRule).not.toHaveBeenCalled();
  });

  it('rejects an unscoped rule (schema_id null) whose condition field is restricted in any workspace schema', async () => {
    const db = makeDb();
    const input: AutomationRuleInput = { ...baseInput, schema_id: null };
    await expect(
      createAutomationRule(db, 'ws-1', input, eventFor(peopleManagerRole))
    ).rejects.toThrow('restricted field');
  });

  it('allows a condition on a restricted field for an author with team access to that group', async () => {
    const db = makeDb();
    const event = eventFor(peopleManagerRole, [
      { teamId: 'team-restricted', role: 'team_reviewer' }
    ]);
    const rule = await createAutomationRule(db, 'ws-1', baseInput, event);
    expect(rule.name).toBe('Flag high earners');
    expect(db.automationRule.createRule).toHaveBeenCalledOnce();
  });

  it('allows rules with only unrestricted condition fields', async () => {
    const db = makeDb();
    const input: AutomationRuleInput = {
      ...baseInput,
      conditions: [{ field: 'title', operator: 'is_not_empty' }]
    };
    const rule = await createAutomationRule(db, 'ws-1', input, eventFor(peopleManagerRole));
    expect(rule.name).toBe('Flag high earners');
  });

  it('rejects a set_field_value action targeting a field the author cannot edit', async () => {
    const db = makeDb();
    const input: AutomationRuleInput = {
      ...baseInput,
      conditions: [],
      actions: [{ kind: 'set_field_value', field: 'salary', value: 90000 }]
    };

    await expect(
      createAutomationRule(db, 'ws-1', input, eventFor(peopleManagerRole))
    ).rejects.toThrow('restricted field');
    expect(db.automationRule.createRule).not.toHaveBeenCalled();
  });

  it('rejects a reference_owner notification targeting a field the author cannot view', async () => {
    const db = makeDb();
    const input: AutomationRuleInput = {
      ...baseInput,
      conditions: [],
      actions: [
        {
          kind: 'send_notification',
          recipient: { kind: 'reference_owner', field: 'salary' },
          message: 'Review this entity'
        }
      ]
    };

    await expect(
      createAutomationRule(db, 'ws-1', input, eventFor(peopleManagerRole))
    ).rejects.toThrow('restricted field');
    expect(db.automationRule.createRule).not.toHaveBeenCalled();
  });

  it('checks access-sensitive actions on every schema for an unscoped rule', async () => {
    const db = makeDb();
    const input: AutomationRuleInput = {
      ...baseInput,
      schema_id: null,
      conditions: [],
      actions: [{ kind: 'set_field_value', field: 'salary', value: 90000 }]
    };

    await expect(
      createAutomationRule(db, 'ws-1', input, eventFor(peopleManagerRole))
    ).rejects.toThrow('restricted field');
    expect(db.catalog.listSchemas).toHaveBeenCalledWith('ws-1');
  });

  it('allows a set_field_value action with edit access', async () => {
    const db = makeDb();
    const input: AutomationRuleInput = {
      ...baseInput,
      conditions: [],
      actions: [{ kind: 'set_field_value', field: 'salary', value: 90000 }]
    };
    const event = eventFor(peopleManagerRole, [{ teamId: 'team-restricted', role: 'team_editor' }]);

    await expect(createAutomationRule(db, 'ws-1', input, event)).resolves.toMatchObject({
      name: 'Flag high earners'
    });
  });

  it('allows a reference_owner notification with view access', async () => {
    const db = makeDb();
    const input: AutomationRuleInput = {
      ...baseInput,
      conditions: [],
      actions: [
        {
          kind: 'send_notification',
          recipient: { kind: 'reference_owner', field: 'salary' },
          message: 'Review this entity'
        }
      ]
    };
    const event = eventFor(peopleManagerRole, [
      { teamId: 'team-restricted', role: 'team_reviewer' }
    ]);

    await expect(createAutomationRule(db, 'ws-1', input, event)).resolves.toMatchObject({
      name: 'Flag high earners'
    });
  });
});

describe('updateAutomationRule', () => {
  const existingRule: AutomationRuleDbResult = {
    id: 'rule-1',
    workspace: 'ws-1',
    name: 'Flag high earners',
    description: null,
    schema_id: 'schema-1',
    trigger: { kind: 'entity_created' },
    conditions: [],
    actions: [{ kind: 'set_field_value', field: 'title', value: 'flagged' }],
    enabled: true,
    created_at: now,
    updated_at: now
  };

  it('rejects adding a restricted-field condition to an existing rule', async () => {
    const db = makeDb(existingRule);
    await expect(
      updateAutomationRule(db, 'ws-1', 'rule-1', baseInput, eventFor(peopleManagerRole))
    ).rejects.toThrow('restricted field');
    expect(db.automationRule.updateRule).not.toHaveBeenCalled();
  });

  it('rejects adding a restricted-field action to an existing rule', async () => {
    const db = makeDb(existingRule);
    const input: AutomationRuleInput = {
      ...baseInput,
      conditions: [],
      actions: [{ kind: 'set_field_value', field: 'salary', value: 90000 }]
    };

    await expect(
      updateAutomationRule(db, 'ws-1', 'rule-1', input, eventFor(peopleManagerRole))
    ).rejects.toThrow('restricted field');
    expect(db.automationRule.updateRule).not.toHaveBeenCalled();
  });
});
