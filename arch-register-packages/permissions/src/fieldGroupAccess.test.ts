import { describe, expect, it } from 'vitest';
import { getFieldGroupAccess } from './fieldGroupAccess.js';
import type { TeamRole, WorkspaceCapability, WorkspaceRoleDefinition } from './types.js';

const contextWithTeamRoles = (
  roles: Record<string, TeamRole[]>,
  overrides: {
    workspaceRole?: string | null;
    workspaceRoles?: Map<string, WorkspaceRoleDefinition>;
    globalAdmin?: boolean;
    workspaceCapabilityCeiling?: Set<WorkspaceCapability>;
  } = {}
) => ({
  teamRolesByTeam: new Map(Object.entries(roles).map(([teamId, r]) => [teamId, new Set(r)])),
  globalPermissions: new Set(overrides.globalAdmin ? (['admin_platform'] as const) : []),
  workspaceRole: overrides.workspaceRole ?? null,
  workspaceRoles: overrides.workspaceRoles ?? new Map(),
  workspaceCapabilityCeiling: overrides.workspaceCapabilityCeiling
});

describe('getFieldGroupAccess', () => {
  it('grants edit when accessControl is absent', () => {
    expect(getFieldGroupAccess(contextWithTeamRoles({}), undefined)).toBe('edit');
  });

  it('grants edit when teamIds is empty', () => {
    expect(getFieldGroupAccess(contextWithTeamRoles({}), { teamIds: [] })).toBe('edit');
  });

  it('grants view for a team_reviewer', () => {
    const context = contextWithTeamRoles({ team1: ['team_reviewer'] });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('view');
  });

  it('grants edit for a team_editor', () => {
    const context = contextWithTeamRoles({ team1: ['team_editor'] });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('edit');
  });

  it('grants edit for a team_admin', () => {
    const context = contextWithTeamRoles({ team1: ['team_admin'] });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('edit');
  });

  it('takes the best access across multiple assigned teams', () => {
    const context = contextWithTeamRoles({ team1: ['team_reviewer'], team2: ['team_editor'] });
    expect(getFieldGroupAccess(context, { teamIds: ['team1', 'team2'] })).toBe('edit');
  });

  it('returns none when the caller has no role in any assigned team', () => {
    const context = contextWithTeamRoles({ team1: ['team_reviewer'] });
    expect(getFieldGroupAccess(context, { teamIds: ['team2'] })).toBe('none');
  });

  it('returns view when only some assigned teams grant reviewer and none grant editor', () => {
    const context = contextWithTeamRoles({ team1: ['team_reviewer'] });
    expect(getFieldGroupAccess(context, { teamIds: ['team1', 'team2'] })).toBe('view');
  });

  it('grants edit to a global admin regardless of team membership', () => {
    const context = contextWithTeamRoles({}, { globalAdmin: true });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('edit');
  });

  it('grants edit to a workspace role with ws.settings, schema.edit and ent.edit, regardless of team membership', () => {
    const workspaceRoles = new Map<string, WorkspaceRoleDefinition>([
      [
        'admin',
        {
          id: 'admin',
          name: 'Admin',
          description: '',
          tone: '',
          builtin: true,
          capabilities: ['ws.settings', 'schema.edit', 'ent.edit']
        }
      ]
    ]);
    const context = contextWithTeamRoles({}, { workspaceRole: 'admin', workspaceRoles });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('edit');
  });

  it('does not bypass restriction for a workspace role holding only people.role', () => {
    const workspaceRoles = new Map<string, WorkspaceRoleDefinition>([
      [
        'people-manager',
        {
          id: 'people-manager',
          name: 'People manager',
          description: '',
          tone: '',
          builtin: false,
          capabilities: ['people.role']
        }
      ]
    ]);
    const context = contextWithTeamRoles({}, { workspaceRole: 'people-manager', workspaceRoles });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('none');
  });

  it('does not bypass restriction for a workspace role holding only two of the three bypass capabilities', () => {
    const workspaceRoles = new Map<string, WorkspaceRoleDefinition>([
      [
        'partial-admin',
        {
          id: 'partial-admin',
          name: 'Partial admin',
          description: '',
          tone: '',
          builtin: false,
          capabilities: ['ws.settings', 'schema.edit']
        }
      ]
    ]);
    const context = contextWithTeamRoles({}, { workspaceRole: 'partial-admin', workspaceRoles });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('none');
  });

  it('does not bypass restriction for a workspace role lacking all bypass capabilities', () => {
    const workspaceRoles = new Map<string, WorkspaceRoleDefinition>([
      [
        'editor',
        {
          id: 'editor',
          name: 'Editor',
          description: '',
          tone: '',
          builtin: true,
          capabilities: ['content.edit']
        }
      ]
    ]);
    const context = contextWithTeamRoles({}, { workspaceRole: 'editor', workspaceRoles });
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('none');
  });

  it('does not bypass restriction for an API token ceiling missing any bypass capability', () => {
    const context = contextWithTeamRoles(
      {},
      { globalAdmin: true, workspaceCapabilityCeiling: new Set(['content.view']) }
    );
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('none');
  });

  it('does not bypass restriction for an API token ceiling with only some bypass capabilities', () => {
    const context = contextWithTeamRoles(
      {},
      { workspaceCapabilityCeiling: new Set(['ws.settings', 'schema.edit']) }
    );
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('none');
  });

  it('bypasses restriction for an API token ceiling that includes all three bypass capabilities', () => {
    const context = contextWithTeamRoles(
      {},
      { workspaceCapabilityCeiling: new Set(['ws.settings', 'schema.edit', 'ent.edit']) }
    );
    expect(getFieldGroupAccess(context, { teamIds: ['team1'] })).toBe('edit');
  });
});
