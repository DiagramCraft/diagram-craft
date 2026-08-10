import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  buildAuthorizationContext,
  PermissionChecker,
  type EntitySchema
} from '@arch-register/permissions';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureSchema, createFixtureWorkspace } from './projectFixtures';
import { createFixtureUser } from './authFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';
import { buildEntityViewPermissionScope } from '../../domain/catalog/db/entityPermissionScope';
import { listEntitiesWithCount } from '../../domain/catalog/entityQueryOperations';

const checker = new PermissionChecker();

const containmentField = (schemaId: string): SchemaField => ({
  id: 'parent',
  name: 'Parent',
  type: 'containment',
  schemaId,
  minCount: 0,
  maxCount: 1,
  requirementLevel: 'optional'
});

const ids = (entities: { id: string }[]) => entities.map(entity => entity.id);

runContractSuiteAgainstBothDrivers('Entity permission scope', getDb => {
  it('matches PermissionChecker for owner, containment, direct, and subtree visibility', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const schemaId = await createFixtureSchema(db, workspace);
    const schema = (await db.catalog.getSchema(workspace, schemaId))!;
    await db.catalog.updateSchema(workspace, schemaId, {
      ...schema,
      fields: [containmentField(schemaId)]
    });

    const teamId = randomUUID();
    await db.workspace.replaceTeams(workspace, [
      {
        id: teamId,
        workspace,
        name: 'Platform team',
        sort_order: 0,
        color: null,
        description: '',
        created_at: new Date()
      }
    ]);
    await db.workspace.replaceTeamAssignments(workspace, [
      {
        workspace,
        team_id: teamId,
        user_id: user.id,
        role: 'team_reviewer',
        created_at: new Date()
      }
    ]);

    const owned = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: '01 owned',
      owner: teamId
    });
    const parent = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: '02 parent',
      owner: teamId
    });
    const child = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: '03 child',
      data: { parent: [parent.id] }
    });
    const grantedRoot = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: '04 granted root'
    });
    const grantedChild = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: '05 granted child',
      data: { parent: [grantedRoot.id] }
    });
    const denied = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: '06 denied'
    });

    const grants = await db.catalog.replaceEntityGrants(workspace, grantedRoot.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: grantedRoot.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'subtree',
        created_at: new Date()
      }
    ]);
    const entities = [owned, parent, child, grantedRoot, grantedChild, denied];
    const schemas = [
      {
        ...(await db.catalog.getSchema(workspace, schemaId))!,
        fields: [containmentField(schemaId)]
      }
    ] as EntitySchema[];
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId, role: 'team_reviewer' }],
      schemas,
      entities,
      grants
    });
    const scope = buildEntityViewPermissionScope(authCtx)!;
    const oracle = entities
      .filter(entity => checker.hasEntityPermission(authCtx, entity, 'view_entity'))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    const pageOne = await db.catalog.listEntitiesPaginated(
      workspace,
      { permissionScope: scope },
      { limit: 2, offset: 0 }
    );
    const pageTwo = await db.catalog.listEntitiesPaginated(
      workspace,
      { permissionScope: scope },
      { limit: 2, offset: 2 }
    );
    const pageThree = await db.catalog.listEntitiesPaginated(
      workspace,
      { permissionScope: scope },
      { limit: 2, offset: 4 }
    );
    expect(ids([...pageOne, ...pageTwo, ...pageThree])).toEqual(ids(oracle));
    expect(ids(oracle)).toEqual(ids([owned, parent, child, grantedRoot, grantedChild]));
    expect(ids(oracle)).not.toContain(denied.id);
  });

  it('applies permission scope before EntityQuery pagination and count', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const schemaId = await createFixtureSchema(db, workspace);
    const schema = (await db.catalog.getSchema(workspace, schemaId))!;
    const visible = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: '01 visible'
    });
    await createFixtureCatalogEntity(db, workspace, schemaId, { name: '02 hidden' });
    const grants = await db.catalog.replaceEntityGrants(workspace, visible.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: visible.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'self',
        created_at: new Date()
      }
    ]);
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      schemas: [schema],
      entities: [visible],
      grants
    });

    const result = await listEntitiesWithCount(db, workspace, authCtx, {
      entityQuery: { root: { kind: 'and', children: [] } },
      limit: 1,
      offset: 0
    });

    expect(result.total).toBe(1);
    expect(result.items.map(item => item._uid)).toEqual([visible.id]);
  });

  it('keeps the SQL scope parameter count independent of workspace size', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const schemaId = await createFixtureSchema(db, workspace);
    const schema = (await db.catalog.getSchema(workspace, schemaId))!;
    const visible = await createFixtureCatalogEntity(db, workspace, schemaId, {
      name: 'visible'
    });
    for (let index = 0; index < 250; index++) {
      await createFixtureCatalogEntity(db, workspace, schemaId, { name: `hidden-${index}` });
    }
    const grants = await db.catalog.replaceEntityGrants(workspace, visible.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: visible.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'self',
        created_at: new Date()
      }
    ]);
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      schemas: [schema as EntitySchema],
      entities: [],
      grants
    });
    const scope = buildEntityViewPermissionScope(authCtx)!;
    const page = await db.catalog.listEntitiesPaginated(
      workspace,
      { permissionScope: scope },
      { limit: 1, offset: 0 }
    );
    expect(ids(page)).toEqual([visible.id]);
    expect(scope.teamIds).toHaveLength(0);
  });
});
