import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import type { DatabaseAdapter } from '../database';
import { createFixtureSchema, createFixtureWorkspace } from './projectFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';

const createFixtureTeam = async (db: DatabaseAdapter, workspace: string) => {
  const teamId = randomUUID();
  await db.workspace.replaceTeams(workspace, [
    {
      id: teamId,
      workspace,
      name: `Team ${teamId}`,
      sort_order: 0,
      color: null,
      description: '',
      created_at: new Date()
    }
  ]);
  return teamId;
};

const createFixtureRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  inSchemaIds: string[],
  outSchemaIds: string[],
  id = randomUUID()
) => {
  const now = new Date();
  await db.relation.createRelationSchema({
    id,
    workspace,
    name: `Relation schema ${id}`,
    description: '',
    in_schema_ids: inSchemaIds,
    out_schema_ids: outSchemaIds,
    fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }],
    groups: [],
    shared_field_group_links: [],
    color: null,
    icon: null,
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  });
  return id;
};

runContractSuiteAgainstBothDrivers('RelationDatabase', getDb => {
  describe('relation schemas', () => {
    it('creates, updates, versions and deletes a relation schema', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const appSchema = await createFixtureSchema(db, workspace);
      const dbSchema = await createFixtureSchema(db, workspace);
      const id = await createFixtureRelationSchema(db, workspace, [appSchema], [dbSchema]);

      const fetched = await db.relation.getRelationSchema(workspace, id);
      expect(fetched!.in_schema_ids).toEqual([appSchema]);
      expect(fetched!.out_schema_ids).toEqual([dbSchema]);
      expect(fetched!.version).toBe(1);

      const updated = await db.relation.updateRelationSchema(workspace, id, {
        name: 'renamed relation schema',
        description: 'updated',
        in_schema_ids: [appSchema],
        out_schema_ids: [dbSchema],
        fields: fetched!.fields,
        groups: [],
        shared_field_group_links: [],
        color: '#ff0000',
        icon: null,
        version: 2,
        updated_at: new Date()
      });
      expect(updated!.name).toBe('renamed relation schema');
      expect(updated!.version).toBe(2);

      await db.relation.createRelationSchemaVersion({
        id: randomUUID(),
        workspace,
        schema_id: id,
        version: 2,
        name: updated!.name,
        description: updated!.description,
        in_schema_ids: updated!.in_schema_ids,
        out_schema_ids: updated!.out_schema_ids,
        fields: updated!.fields,
        groups: updated!.groups ?? [],
        color: updated!.color,
        icon: updated!.icon,
        change_summary: { renamed: true },
        created_by: null,
        created_at: new Date()
      });
      const versions = await db.relation.listRelationSchemaVersions(workspace, id);
      expect(versions).toHaveLength(1);
      expect(versions[0]!.version).toBe(2);

      const deleted = await db.relation.deleteRelationSchema(workspace, id);
      expect(deleted!.id).toBe(id);
      expect(await db.relation.getRelationSchema(workspace, id)).toBeNull();
    });
  });

  describe('relation instances', () => {
    it('creates, lists, updates and deletes a relation instance between two entities', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const appSchemaId = await createFixtureSchema(db, workspace);
      const dbSchemaId = await createFixtureSchema(db, workspace);
      const relationSchemaId = await createFixtureRelationSchema(
        db,
        workspace,
        [appSchemaId],
        [dbSchemaId]
      );

      const app = await createFixtureCatalogEntity(db, workspace, appSchemaId, {
        name: 'Checkout Service'
      });
      const database = await createFixtureCatalogEntity(db, workspace, dbSchemaId, {
        name: 'Orders DB'
      });

      const now = new Date();
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: app.id,
        out_entity_id: database.id,
        data: { note: 'reads and writes order data' },
        created_at: now,
        updated_at: now
      });
      expect(relation.in_entity_name).toBe('Checkout Service');
      expect(relation.out_entity_name).toBe('Orders DB');
      expect(relation.schema_name).toContain('Relation schema');
      expect(relation.data).toEqual({ note: 'reads and writes order data' });
      expect(relation.version).toBe(1);

      const fetched = await db.relation.getRelation(workspace, relation.id);
      expect(fetched!.id).toBe(relation.id);

      const { items, total } = await db.relation.listRelations(
        workspace,
        { schemaId: relationSchemaId },
        {}
      );
      expect(total).toBe(1);
      expect(items[0]!.id).toBe(relation.id);

      const forEntity = await db.relation.listRelationsForEntity(workspace, app.id);
      expect(forEntity.outgoing).toHaveLength(1);
      expect(forEntity.incoming).toHaveLength(0);

      const updated = await db.relation.updateRelation(workspace, relation.id, {
        data: { note: 'updated note' },
        version: 2,
        updated_at: new Date()
      });
      expect(updated!.data).toEqual({ note: 'updated note' });
      expect(updated!.version).toBe(2);

      expect(await db.relation.countRelationsForSchema(workspace, relationSchemaId)).toBe(1);

      const deleted = await db.relation.deleteRelation(workspace, relation.id);
      expect(deleted!.id).toBe(relation.id);
      expect(await db.relation.getRelation(workspace, relation.id)).toBeNull();
      expect(await db.relation.countRelationsForSchema(workspace, relationSchemaId)).toBe(0);
    });

    it('defaults owner/lifecycle at creation and supports independent updates, including clearing to null', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const appSchemaId = await createFixtureSchema(db, workspace);
      const dbSchemaId = await createFixtureSchema(db, workspace);
      const relationSchemaId = await createFixtureRelationSchema(
        db,
        workspace,
        [appSchemaId],
        [dbSchemaId]
      );
      const teamId = await createFixtureTeam(db, workspace);

      const app = await createFixtureCatalogEntity(db, workspace, appSchemaId, {
        owner: teamId
      });
      const database = await createFixtureCatalogEntity(db, workspace, dbSchemaId);

      const now = new Date();
      // Simulates createWorkspaceRelation's default-copy from the "in" entity.
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: app.id,
        out_entity_id: database.id,
        data: {},
        owner: teamId,
        created_at: now,
        updated_at: now
      });
      expect(relation.owner).toBe(teamId);
      expect(relation.owner_name).toBeTruthy();
      expect(relation.lifecycle).toBeNull();

      // Omitting owner/lifecycle on update leaves them unchanged.
      const afterDataUpdate = await db.relation.updateRelation(workspace, relation.id, {
        data: { note: 'updated' },
        version: 2,
        updated_at: new Date()
      });
      expect(afterDataUpdate!.owner).toBe(teamId);

      // Explicitly clearing owner to null.
      const afterClear = await db.relation.updateRelation(workspace, relation.id, {
        data: { note: 'updated' },
        owner: null,
        version: 3,
        updated_at: new Date()
      });
      expect(afterClear!.owner).toBeNull();
    });

    it('lists relations for a batch of entities, grouped by endpoint', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const appSchemaId = await createFixtureSchema(db, workspace);
      const dbSchemaId = await createFixtureSchema(db, workspace);
      const relationSchemaId = await createFixtureRelationSchema(
        db,
        workspace,
        [appSchemaId],
        [dbSchemaId]
      );

      const app = await createFixtureCatalogEntity(db, workspace, appSchemaId, {
        name: 'Checkout Service'
      });
      const otherApp = await createFixtureCatalogEntity(db, workspace, appSchemaId, {
        name: 'Billing Service'
      });
      const database = await createFixtureCatalogEntity(db, workspace, dbSchemaId, {
        name: 'Orders DB'
      });

      const now = new Date();
      await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: app.id,
        out_entity_id: database.id,
        data: { note: 'checkout reads and writes order data' },
        created_at: now,
        updated_at: now
      });
      await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: otherApp.id,
        out_entity_id: database.id,
        data: { note: 'billing reads and writes order data' },
        created_at: now,
        updated_at: now
      });

      const batch = await db.relation.listRelationsForEntities(workspace, [app.id, database.id]);
      expect(batch.outgoing).toHaveLength(1);
      expect(batch.outgoing[0]!.in_entity_id).toBe(app.id);
      expect(batch.incoming).toHaveLength(2);
      expect(new Set(batch.incoming.map(row => row.in_entity_id))).toEqual(
        new Set([app.id, otherApp.id])
      );

      expect(await db.relation.listRelationsForEntities(workspace, [])).toEqual({
        outgoing: [],
        incoming: []
      });
    });

    it('renames and removes relation data fields across instances', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const appSchemaId = await createFixtureSchema(db, workspace);
      const dbSchemaId = await createFixtureSchema(db, workspace);
      const relationSchemaId = await createFixtureRelationSchema(
        db,
        workspace,
        [appSchemaId],
        [dbSchemaId]
      );
      const app = await createFixtureCatalogEntity(db, workspace, appSchemaId);
      const database = await createFixtureCatalogEntity(db, workspace, dbSchemaId);

      const now = new Date();
      await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: app.id,
        out_entity_id: database.id,
        data: { note: 'hello', protocol: 'https' },
        created_at: now,
        updated_at: now
      });

      const renamedCount = await db.relation.renameRelationDataField(
        workspace,
        relationSchemaId,
        'note',
        'comment'
      );
      expect(renamedCount).toBe(1);
      const afterRename = (await db.relation.listRelations(workspace, {}, {})).items[0]!;
      expect(afterRename.data).toEqual({ comment: 'hello', protocol: 'https' });

      const removedCount = await db.relation.removeRelationDataField(
        workspace,
        relationSchemaId,
        'protocol'
      );
      expect(removedCount).toBe(1);
      const afterRemove = (await db.relation.listRelations(workspace, {}, {})).items[0]!;
      expect(afterRemove.data).toEqual({ comment: 'hello' });
    });
  });
});
