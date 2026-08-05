import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import { isAutomationRuleAuthorized } from './automationRuleAuthorization';

const schema = {
  fields: [
    { id: 'salary', name: 'Salary', type: 'number', groupId: 'restricted' },
    { id: 'title', name: 'Title', type: 'text' }
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['finance'] } }]
} as unknown as SchemaDbResult;

const rule = {
  resource_type: 'entity' as const,
  trigger: { kind: 'entity_created' as const },
  conditions: [{ field: 'salary', operator: 'equals' as const, value: 100000 }],
  actions: [{ kind: 'set_field_value' as const, field: 'title', value: 'high earner' }]
};

const contextFor = (teamAssignments: { teamId: string; role: 'team_reviewer' | 'team_editor' }[]) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    workspaceRoles: [],
    teamAssignments,
    schemas: [],
    entities: [],
    grants: []
  });

describe('isAutomationRuleAuthorized', () => {
  it('allows a rule while its owner can view its condition field', () => {
    expect(
      isAutomationRuleAuthorized(
        contextFor([{ teamId: 'finance', role: 'team_reviewer' }]),
        schema,
        rule
      )
    ).toBe(true);
  });

  it('denies a rule after the owner loses team membership', () => {
    expect(isAutomationRuleAuthorized(contextFor([]), schema, rule)).toBe(false);
  });

  it('denies a rule after the field is reassigned to another team', () => {
    const reassignedSchema = {
      ...schema,
      groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['legal'] } }]
    } as unknown as SchemaDbResult;

    expect(
      isAutomationRuleAuthorized(
        contextFor([{ teamId: 'finance', role: 'team_reviewer' }]),
        reassignedSchema,
        rule
      )
    ).toBe(false);
  });

  it('requires edit access for a restricted field target', () => {
    const writeRule = {
      ...rule,
      conditions: [],
      actions: [{ kind: 'set_field_value' as const, field: 'salary', value: 100000 }]
    };

    expect(
      isAutomationRuleAuthorized(
        contextFor([{ teamId: 'finance', role: 'team_reviewer' }]),
        schema,
        writeRule
      )
    ).toBe(false);
    expect(
      isAutomationRuleAuthorized(
        contextFor([{ teamId: 'finance', role: 'team_editor' }]),
        schema,
        writeRule
      )
    ).toBe(true);
  });

  it('denies conditions that reference an unknown field', () => {
    expect(
      isAutomationRuleAuthorized(
        contextFor([{ teamId: 'finance', role: 'team_reviewer' }]),
        schema,
        { ...rule, conditions: [{ field: 'removed', operator: 'is_not_empty' as const }] }
      )
    ).toBe(false);
  });

  it('denies rules when their schema is unavailable', () => {
    expect(isAutomationRuleAuthorized(contextFor([]), null, rule)).toBe(false);
  });

  it('denies a set_field_value action targeting an unknown field', () => {
    expect(
      isAutomationRuleAuthorized(contextFor([]), schema, {
        ...rule,
        conditions: [],
        actions: [{ kind: 'set_field_value' as const, field: 'removed', value: 'x' }]
      })
    ).toBe(false);
  });
});
