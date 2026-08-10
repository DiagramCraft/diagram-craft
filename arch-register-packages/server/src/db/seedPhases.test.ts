import { describe, expect, it } from 'vitest';
import { seededTestPassword, seededUsers, seededWorkspaces } from './seedFixtures';
import {
  seedAiConfiguration,
  seedCatalogDefinitions,
  seedCatalogEntities,
  seedPublicIdCounters,
  seedUsersAndRoles,
  seedWorkspaceBase,
  seedWorkspaceConfiguration
} from './seedPhases';
import {
  seedEntities,
  seedEnums,
  seedLifecycleStates,
  seedOwners,
  seedSchemas,
  seedWorkspaces
} from './seedData';
import { provisionSqliteDatabase } from './testSupport/provisionDatabase';

describe('composable seed phases', () => {
  it('builds a minimal profile without full bootstrap data', async () => {
    const provisioned = await provisionSqliteDatabase();
    const timestamp = new Date('2026-08-10T00:00:00.000Z');
    const testAdminId = '00000000-0000-0000-0000-e2e000000001';
    const defaultWorkspace = seededWorkspaces.default.id;

    try {
      await seedWorkspaceBase(provisioned.db);
      await seedWorkspaceConfiguration(provisioned.db, {
        supportedCurrencies: false,
        projectEntityTypes: false,
        assessmentTypes: false
      });
      await seedCatalogDefinitions(provisioned.db, { sharedFieldGroups: false });
      await seedAiConfiguration(provisioned.db);
      await seedUsersAndRoles(provisioned.db, {
        users: [
          {
            id: testAdminId,
            user_id: 'test-admin',
            email: 'admin@e2e.test',
            display_name: 'E2E Admin',
            color: null
          }
        ],
        password: seededTestPassword,
        globalRoleAssignments: [
          { user_id: testAdminId, role: 'global_admin', created_at: timestamp }
        ],
        workspaceMembers: seedWorkspaces.map(workspace => ({
          workspace: workspace.id,
          user_id: testAdminId,
          role: 'admin',
          created_at: timestamp
        })),
        createdAt: timestamp
      });

      expect(await provisioned.db.workspace.listWorkspaces()).toHaveLength(seedWorkspaces.length);
      expect(await provisioned.db.workspace.listLifecycleStates(defaultWorkspace)).toHaveLength(
        seedLifecycleStates.filter(state => state.workspace === defaultWorkspace).length
      );
      expect(await provisioned.db.workspace.listTeams(defaultWorkspace)).toHaveLength(
        seedOwners.filter(owner => owner.workspace === defaultWorkspace).length
      );
      expect(await provisioned.db.workspace.listProjectEntityTypes(defaultWorkspace)).toEqual([]);
      expect(await provisioned.db.workspace.listAssessmentTypes(defaultWorkspace)).toEqual([]);
      expect(
        (await provisioned.db.workspace.getSupportedCurrencies(defaultWorkspace)).currencies.map(
          currency => currency.code
        )
      ).toEqual(['USD', 'EUR', 'GBP', 'SEK', 'NOK', 'DKK']);
      expect(await provisioned.db.catalog.listEnums(defaultWorkspace)).toHaveLength(
        seedEnums.filter(enumeration => enumeration.workspace === defaultWorkspace).length
      );
      expect(await provisioned.db.catalog.listSchemas(defaultWorkspace)).toHaveLength(
        seedSchemas.filter(schema => schema.workspace === defaultWorkspace).length
      );
      expect(await provisioned.db.catalog.listSharedFieldGroups(defaultWorkspace)).toEqual([]);
      expect(await provisioned.db.catalog.listEntities(defaultWorkspace)).toEqual([]);
      expect(await provisioned.db.project.listProjects(defaultWorkspace)).toEqual([]);
      expect(await provisioned.db.relation.listRelationSchemas(defaultWorkspace)).toEqual([]);
      const users = await provisioned.db.auth.listUsers();
      expect(users.filter(user => !user.is_system_actor)).toHaveLength(1);
      expect(await provisioned.db.auth.getUser(seededUsers.globalAdmin.id)).toBeNull();
      expect(await provisioned.db.auth.listGlobalRoleAssignments(testAdminId)).toEqual([
        expect.objectContaining({ user_id: testAdminId, role: 'global_admin' })
      ]);
      expect(await provisioned.db.workspace.getWorkspaceRole(defaultWorkspace, testAdminId)).toBe(
        'admin'
      );
      for (const workspace of seedWorkspaces) {
        await expect(provisioned.db.ai.getAiConfig(workspace.id)).resolves.toMatchObject({
          enabled: false
        });
      }
    } finally {
      await provisioned.teardown();
    }
  });

  it('sets the next public-ID number from selected records', async () => {
    const provisioned = await provisionSqliteDatabase();
    const timestamp = new Date('2026-08-10T00:00:00.000Z');

    try {
      await seedWorkspaceBase(provisioned.db);
      await seedCatalogDefinitions(provisioned.db, {
        enums: false,
        sharedFieldGroups: false
      });
      await seedPublicIdCounters(
        provisioned.db,
        [{ public_id: 'DW-4' }, { public_id: 'DW-12' }, { public_id: 'SYS-7' }],
        timestamp
      );

      expect(await provisioned.db.workspace.allocatePublicId('DW', timestamp)).toBe(13);
      expect(await provisioned.db.workspace.allocatePublicId('SYS', timestamp)).toBe(8);
    } finally {
      await provisioned.teardown();
    }
  });

  it('keeps entity seeding separate from counter finalization', async () => {
    const provisioned = await provisionSqliteDatabase();
    const timestamp = new Date('2026-08-10T00:00:00.000Z');
    const defaultWorkspace = seededWorkspaces.default.id;
    const entities = seedEntities.filter(entity => entity.project_id == null);

    try {
      await seedWorkspaceBase(provisioned.db);
      await seedWorkspaceConfiguration(provisioned.db, {
        supportedCurrencies: false,
        projectEntityTypes: false,
        assessmentTypes: false
      });
      await seedCatalogDefinitions(provisioned.db, { sharedFieldGroups: false });
      await seedCatalogEntities(provisioned.db, entities);
      await seedPublicIdCounters(provisioned.db, entities, timestamp);

      const systemIds = entities
        .map(entity => entity.public_id)
        .filter((publicId): publicId is string => publicId?.startsWith('SYS-') ?? false)
        .map(publicId => Number(publicId.split('-').at(-1)));
      const nextSystemId = Math.max(...systemIds) + 1;

      expect(await provisioned.db.catalog.listEntities(defaultWorkspace)).toHaveLength(
        entities.filter(entity => entity.workspace === defaultWorkspace).length
      );
      expect(await provisioned.db.workspace.allocatePublicId('SYS', timestamp)).toBe(nextSystemId);
    } finally {
      await provisioned.teardown();
    }
  });
});
