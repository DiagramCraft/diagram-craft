import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import {
  filterRestrictedFieldGroups,
  isFieldViewRestricted,
  requireNoRestrictedFieldWrites
} from './fieldGroupAccessControl';
import type { FieldGroupSchemaShape } from './fieldGroupAccessControl';

const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
      teamRoles.map(role => ({ teamId, role }))
    ),
    schemas: [],
    entities: [],
    grants: []
  });

const schema: FieldGroupSchemaShape = {
  fields: [
    { id: 'name', name: 'Name', requirementLevel: null, type: 'text' } as never,
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    } as never,
    {
      id: 'reviewOnly',
      name: 'Review Only',
      requirementLevel: null,
      type: 'text',
      groupId: 'reviewed'
    } as never
  ],
  groups: [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } },
    { id: 'reviewed', name: 'Reviewed', accessControl: { teamIds: ['team-reviewed'] } }
  ]
};

describe('filterRestrictedFieldGroups', () => {
  it('returns data unchanged when authCtx is null', () => {
    const data = { name: 'x', secret: 'y' };
    expect(filterRestrictedFieldGroups(null, schema, data)).toEqual(data);
  });

  it('returns data unchanged when schema is null', () => {
    const data = { name: 'x', secret: 'y' };
    expect(filterRestrictedFieldGroups(authCtxWithTeamRoles({}), null, data)).toEqual(data);
  });

  it('omits fields in groups the caller cannot view', () => {
    const authCtx = authCtxWithTeamRoles({});
    const data = { name: 'x', secret: 'y', reviewOnly: 'z' };
    expect(filterRestrictedFieldGroups(authCtx, schema, data)).toEqual({ name: 'x' });
  });

  it('passes through fields in groups the caller can view or edit, and ungrouped fields', () => {
    const authCtx = authCtxWithTeamRoles({
      'team-restricted': ['team_reviewer'],
      'team-reviewed': ['team_editor']
    });
    const data = { name: 'x', secret: 'y', reviewOnly: 'z' };
    expect(filterRestrictedFieldGroups(authCtx, schema, data)).toEqual(data);
  });
});

describe('isFieldViewRestricted', () => {
  it('is false when authCtx is null', () => {
    expect(isFieldViewRestricted(null, schema, 'secret')).toBe(false);
  });

  it('is false when schema is null or undefined', () => {
    const authCtx = authCtxWithTeamRoles({});
    expect(isFieldViewRestricted(authCtx, null, 'secret')).toBe(false);
    expect(isFieldViewRestricted(authCtx, undefined, 'secret')).toBe(false);
  });

  it('is false for ungrouped fields', () => {
    const authCtx = authCtxWithTeamRoles({});
    expect(isFieldViewRestricted(authCtx, schema, 'name')).toBe(false);
  });

  it('is true when the caller has no access to the field group', () => {
    const authCtx = authCtxWithTeamRoles({});
    expect(isFieldViewRestricted(authCtx, schema, 'secret')).toBe(true);
  });

  it('is false when the caller has view or edit access to the field group', () => {
    const viewOnly = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    expect(isFieldViewRestricted(viewOnly, schema, 'secret')).toBe(false);
    const editor = authCtxWithTeamRoles({ 'team-restricted': ['team_editor'] });
    expect(isFieldViewRestricted(editor, schema, 'secret')).toBe(false);
  });
});

describe('requireNoRestrictedFieldWrites', () => {
  it('does not throw when no changed field is restricted', () => {
    const authCtx = authCtxWithTeamRoles({});
    expect(() => requireNoRestrictedFieldWrites(authCtx, schema, ['name'])).not.toThrow();
  });

  it('throws when a changed field is in a group the caller cannot edit', () => {
    const authCtx = authCtxWithTeamRoles({});
    expect(() => requireNoRestrictedFieldWrites(authCtx, schema, ['secret'])).toThrow();
  });

  it('throws when the caller only has view access to the field group', () => {
    const authCtx = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    expect(() => requireNoRestrictedFieldWrites(authCtx, schema, ['secret'])).toThrow();
  });

  it('does not throw when the caller has edit access to the field group', () => {
    const authCtx = authCtxWithTeamRoles({ 'team-restricted': ['team_editor'] });
    expect(() => requireNoRestrictedFieldWrites(authCtx, schema, ['secret'])).not.toThrow();
  });

  it('does not throw for unchanged restricted fields not included in changedFieldIds', () => {
    const authCtx = authCtxWithTeamRoles({});
    expect(() => requireNoRestrictedFieldWrites(authCtx, schema, ['name'])).not.toThrow();
  });

  it('does not throw for a global admin regardless of team membership', () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      schemas: [],
      entities: [],
      grants: []
    });
    expect(() => requireNoRestrictedFieldWrites(authCtx, schema, ['secret'])).not.toThrow();
  });
});
