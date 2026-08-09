import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

test.describe('auth workspace metadata permissions', () => {
  test('returns workspace metadata only for the user membership workspaces', async ({
    personas
  }) => {
    const result = await personas.workspaceReviewer.orpc.authProtected.me(undefined);

    expect(result.workspace_roles).toEqual({
      '90000000-0000-0000-0000-000000000001': 'reviewer'
    });
    expect(result.teams_by_workspace).toHaveProperty('90000000-0000-0000-0000-000000000001');
    expect(result.teams_by_workspace).not.toHaveProperty('90000000-0000-0000-0000-000000000002');
    expect(result.workspace_role_definitions_by_workspace).toHaveProperty(
      '90000000-0000-0000-0000-000000000001'
    );
    expect(result.workspace_role_definitions_by_workspace).not.toHaveProperty(
      '90000000-0000-0000-0000-000000000002'
    );
  });

  test('does not disclose workspace metadata to an outsider', async ({ personas }) => {
    const result = await personas.outsider.orpc.authProtected.me(undefined);

    expect(result.workspace_roles).toEqual({});
    expect(result.team_assignments_by_workspace).toEqual({});
    expect(result.teams_by_workspace).toEqual({});
    expect(result.workspace_role_definitions_by_workspace).toEqual({});
  });
});
