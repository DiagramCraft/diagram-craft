import type { AuthorizationContext } from '@arch-register/permissions';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { downloadEntityImportTemplate } from './entityCsvOperations';

const adminContext: AuthorizationContext = {
  userId: 'user-1',
  globalRoles: new Set(['global_admin']),
  globalPermissions: new Set(['admin_platform']),
  workspaceRole: null,
  workspaceRoles: new Map(),
  teamIds: new Set(),
  teamAssignments: [],
  teamRolesByTeam: new Map(),
  teams: [],
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

describe('downloadEntityImportTemplate', () => {
  it('builds the template outside the transport handler', async () => {
    const getSchema = vi.fn().mockResolvedValue({
      id: 'application',
      name: 'Business Application',
      fields: [{ id: 'criticality', name: 'Criticality', type: 'text' }]
    });
    const db = { catalog: { getSchema } } as unknown as DatabaseAdapter;

    const response = await downloadEntityImportTemplate(
      db,
      'workspace-1',
      adminContext,
      'application'
    );

    expect(getSchema).toHaveBeenCalledWith('workspace-1', 'application');
    expect(response.headers['content-disposition']).toContain(
      'business-application-import-template.csv'
    );
    expect(await response.body.text()).toContain('"Criticality"');
  });
});
