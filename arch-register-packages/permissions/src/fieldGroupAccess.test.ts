import { describe, expect, it } from 'vitest';
import { getFieldGroupAccess } from './fieldGroupAccess.js';
import type { TeamRole } from './types.js';

const contextWithTeamRoles = (roles: Record<string, TeamRole[]>) => ({
  teamRolesByTeam: new Map(Object.entries(roles).map(([teamId, r]) => [teamId, new Set(r)]))
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
});
