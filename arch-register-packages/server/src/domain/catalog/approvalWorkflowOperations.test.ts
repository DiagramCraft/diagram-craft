import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { listEligibleApproverIds } from './approvalWorkflowOperations';

describe('listEligibleApproverIds', () => {
  it('preserves capability and owner-team eligibility while batching workspace data', async () => {
    const listUsers = vi.fn(async () => [
      { id: 'owner-admin', is_active: true },
      { id: 'workspace-approver', is_active: true },
      { id: 'global-admin', is_active: true },
      { id: 'ordinary-user', is_active: true },
      { id: 'inactive-admin', is_active: false }
    ]);
    const listGlobalRoleAssignments = vi.fn(async (userId?: string) =>
      userId === 'global-admin' ? [{ user_id: userId, role: 'global_admin' as const }] : []
    );
    const getWorkspaceRole = vi.fn(async (_workspace: string, userId: string) =>
      userId === 'workspace-approver' || userId === 'inactive-admin' ? 'admin' : null
    );
    const listTeamAssignments = vi.fn(async () => [
      { team_id: 'team-owner', user_id: 'owner-admin', role: 'team_admin' as const }
    ]);
    const listCustomWorkspaceRoles = vi.fn(async () => []);
    const listTeams = vi.fn(async () => [{ id: 'team-owner', name: 'Owner team' }]);
    const listEntitiesPaginated = vi.fn(async () => []);
    const listSchemas = vi.fn(async () => []);
    const listEntityGrants = vi.fn(async () => []);
    const db = {
      auth: { listUsers, listGlobalRoleAssignments },
      workspace: {
        getWorkspaceRole,
        listCustomWorkspaceRoles,
        listTeamAssignments,
        listTeams
      },
      catalog: { listEntitiesPaginated, listSchemas, listEntityGrants }
    } as unknown as DatabaseAdapter;

    await expect(listEligibleApproverIds(db, 'ws-1', 'team-owner')).resolves.toEqual(
      new Set(['owner-admin', 'workspace-approver', 'global-admin'])
    );

    expect(listTeamAssignments).toHaveBeenCalledTimes(1);
    expect(listTeams).toHaveBeenCalledTimes(1);
    expect(listCustomWorkspaceRoles).toHaveBeenCalledTimes(1);
    expect(listEntitiesPaginated).not.toHaveBeenCalled();
    expect(listSchemas).not.toHaveBeenCalled();
    expect(listEntityGrants).not.toHaveBeenCalled();
  });
});
