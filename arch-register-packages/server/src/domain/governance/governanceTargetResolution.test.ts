import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { resolveApprovalTargets, resolveEscalationTargets } from './governanceTargetResolution';

const makeDb = (overrides: Record<string, unknown> = {}) =>
  ({
    auth: {
      listUsers: vi.fn(async () => [
        { id: 'user-1', is_active: true },
        { id: 'user-2', is_active: true }
      ])
    },
    workspace: {
      listTeams: vi.fn(async () => [{ id: 'team-1' }]),
      listTeamAssignments: vi.fn(async () => [
        { team_id: 'team-1', user_id: 'user-1', role: 'team_admin' },
        { team_id: 'team-1', user_id: 'user-2', role: 'team_editor' }
      ]),
      listWorkspaceMembers: vi.fn(async () => [
        { user_id: 'user-1', role: 'admin' },
        { user_id: 'user-2', role: 'member' }
      ])
    },
    ...overrides
  }) as unknown as DatabaseAdapter;

describe('governance target resolution', () => {
  it('uses a valid strategy target without adding fallback targets', async () => {
    const result = await resolveApprovalTargets(
      makeDb(),
      'workspace-1',
      [{ type: 'team_role', teamId: 'team-1', teamRole: 'team_admin' }],
      {
        requiredApprovals: 1,
        strategy: 'entity-owner-admin',
        strategyConfig: {},
        fallbackUserIds: ['user-2'],
        fallbackTeamIds: []
      },
      1
    );

    expect(result).toEqual([{ type: 'team_role', teamId: 'team-1', teamRole: 'team_admin' }]);
  });

  it('uses configured fallbacks when a strategy has no valid target', async () => {
    const result = await resolveApprovalTargets(
      makeDb(),
      'workspace-1',
      [],
      {
        requiredApprovals: 1,
        strategy: 'entity-owner-admin',
        strategyConfig: {},
        fallbackUserIds: ['user-2'],
        fallbackTeamIds: []
      },
      1
    );

    expect(result).toEqual([{ type: 'user', userId: 'user-2' }]);
  });

  it('uses workspace admins as the final approval fallback', async () => {
    const result = await resolveApprovalTargets(
      makeDb(),
      'workspace-1',
      [],
      {
        requiredApprovals: 1,
        strategy: 'entity-owner-admin',
        strategyConfig: {},
        fallbackUserIds: ['missing-user'],
        fallbackTeamIds: ['missing-team']
      },
      1
    );

    expect(result).toEqual([{ type: 'user', userId: 'user-1' }]);
  });

  it('returns all valid escalation fallback targets', async () => {
    const result = await resolveEscalationTargets(makeDb(), 'workspace-1', [], {
      enabled: true,
      overdueDays: 5,
      strategy: 'document-field',
      strategyConfig: {},
      fallbackUserIds: ['user-1', 'user-2'],
      fallbackTeamIds: ['team-1']
    });

    expect(result).toEqual([
      { type: 'user', userId: 'user-1' },
      { type: 'user', userId: 'user-2' },
      { type: 'team', teamId: 'team-1' }
    ]);
  });

  it('uses workspace-admin capability when escalation has no valid target', async () => {
    const result = await resolveEscalationTargets(makeDb(), 'workspace-1', [], {
      enabled: true,
      overdueDays: 5,
      strategy: 'document-field',
      strategyConfig: {},
      fallbackUserIds: ['missing-user'],
      fallbackTeamIds: ['missing-team']
    });

    expect(result).toEqual([{ type: 'capability', capability: 'ws.settings' }]);
  });
});
