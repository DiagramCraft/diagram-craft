import { randomUUID } from 'node:crypto';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { expect, it } from 'vitest';
import { executeSubjectTraversalAggregation } from '../../domain/catalog/entityTraversalOperations';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '../testSupport/fixtures';
import type { DatabaseAdapter, DbDriver } from '../database';

runContractSuiteAgainstBothDrivers('entityTraversalAggregation', (getDb, _driver: DbDriver) => {
  it('groups only visible entities and does not rank by a restricted criticality field', async () => {
    const db: DatabaseAdapter = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const schemaId = randomUUID();
    const fallbackSchemaId = randomUUID();
    const ownerTeamId = randomUUID();
    const activeLifecycleId = randomUUID();
    await db.workspace.replaceTeams(workspace, [
      {
        id: ownerTeamId,
        workspace,
        name: 'Visible owner',
        sort_order: 0,
        color: null,
        description: '',
        created_at: new Date()
      }
    ]);
    await db.workspace.replaceLifecycleStates(workspace, [
      {
        id: activeLifecycleId,
        workspace,
        label: 'Active',
        color: '#00aa00',
        sort_order: 0,
        created_at: new Date()
      }
    ]);

    await createFixtureSchema(db, workspace, {
      id: schemaId,
      name: 'Restricted service',
      fields: [
        {
          id: 'parent',
          name: 'Parent',
          type: 'containment',
          schemaId,
          minCount: 0,
          maxCount: 1
        },
        {
          id: 'criticality',
          name: 'Criticality',
          type: 'number',
          min: 1,
          max: 5,
          groupId: 'restricted'
        }
      ],
      groups: [
        {
          id: 'restricted',
          name: 'Restricted',
          accessControl: { teamIds: ['secret-team'] }
        }
      ]
    });
    await createFixtureSchema(db, workspace, {
      id: fallbackSchemaId,
      name: 'Other schema',
      fields: [
        {
          id: 'criticality',
          name: 'Criticality',
          type: 'number',
          min: 1,
          max: 5
        }
      ]
    });

    const rootId = randomUUID();
    const visibleId = randomUUID();
    const hiddenId = randomUUID();
    const root = await createFixtureEntity(db, workspace, schemaId, {
      id: rootId,
      name: 'Root service',
      data: { parent: [], criticality: 1 }
    });
    const visible = await createFixtureEntity(db, workspace, schemaId, {
      id: visibleId,
      name: 'Visible child',
      owner: ownerTeamId,
      lifecycle: activeLifecycleId,
      data: { parent: [rootId], criticality: 5 }
    });
    await createFixtureEntity(db, workspace, schemaId, {
      id: hiddenId,
      name: 'Restricted child',
      data: { parent: [rootId], criticality: 3 }
    });

    const rootGrants = await db.catalog.replaceEntityGrants(workspace, root.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: root.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'self',
        created_at: new Date()
      }
    ]);
    const visibleGrants = await db.catalog.replaceEntityGrants(workspace, visible.id, [
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
    const schemas = await db.catalog.listSchemas(workspace);
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      schemas,
      entities: [root, visible],
      grants: [...rootGrants, ...visibleGrants]
    });

    const aggregation = await executeSubjectTraversalAggregation(db, workspace, authCtx, {
      subject: { kind: 'entity', entityId: root.id },
      paths: [
        {
          id: 'subtree',
          steps: [{ kind: 'containmentSubtree', fieldId: 'parent', ownerSchemaId: schemaId }]
        }
      ]
    });

    expect(new Set(aggregation.entities.map(entity => entity.entityId))).toEqual(
      new Set([root.id, visible.id])
    );
    expect(aggregation.entities.every(entity => entity.criticality === null)).toBe(true);
    expect(aggregation.groups.lifecycle).toContainEqual(
      expect.objectContaining({ key: activeLifecycleId, count: 1 })
    );
    expect(aggregation.groups.schema).toMatchObject([{ key: schemaId, count: 2 }]);
    expect(aggregation.groups.criticality).toMatchObject([
      { key: null, label: 'Unrated', count: 2, highestCriticality: null }
    ]);
    expect(aggregation.groups.owner).toContainEqual(
      expect.objectContaining({ key: ownerTeamId, count: 1 })
    );
    expect(aggregation.entities.map(entity => entity.entityId)).not.toContain(hiddenId);
  });
});
