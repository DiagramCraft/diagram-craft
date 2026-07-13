import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { DatabaseError } from '../database';
import {
  createFixtureProject,
  createFixtureSchema,
  createFixtureWorkspace
} from './projectFixtures';
import { createFixtureUser } from './authFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';

runContractSuiteAgainstBothDrivers('CatalogDatabase', getDb => {
  describe('schemas', () => {
    it('creates, updates and deletes a schema', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const id = await createFixtureSchema(db, workspace);

      const fetched = await db.catalog.getSchema(workspace, id);
      expect(fetched!.fields).toEqual([]);

      const updated = await db.catalog.updateSchema(workspace, id, {
        name: 'renamed schema',
        description: 'updated',
        fields: [],
        color: '#ff0000',
        icon: null,
        default_owner: null,
        key_prefix: fetched!.key_prefix,
        updated_at: new Date()
      });
      expect(updated!.name).toBe('renamed schema');

      const byPrefix = await db.catalog.getSchemaByKeyPrefix(fetched!.key_prefix);
      expect(byPrefix!.id).toBe(id);

      const deleted = await db.catalog.deleteSchema(workspace, id);
      expect(deleted!.id).toBe(id);
      expect(await db.catalog.getSchema(workspace, id)).toBeNull();
    });

    it('normalizes a duplicate key_prefix to a unique DatabaseError', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const id = await createFixtureSchema(db, workspace);
      const existing = (await db.catalog.getSchema(workspace, id))!;

      await expect(
        db.catalog.createSchema({
          id: randomUUID(),
          workspace,
          name: 'another schema',
          description: '',
          fields: [],
          color: null,
          icon: null,
          default_owner: null,
          key_prefix: existing.key_prefix,
          created_at: new Date(),
          updated_at: new Date()
        })
      ).rejects.toMatchObject({ code: 'unique' } satisfies Partial<DatabaseError>);
    });
  });

  describe('enums', () => {
    it('creates, updates and deletes an enum with JSON options round-tripped', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.catalog.createEnum({
        id: randomUUID(),
        workspace,
        name: 'Priority',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'high', label: 'High' }
        ],
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      expect(created.options).toEqual([
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' }
      ]);

      const updated = await db.catalog.updateEnum(workspace, created.id, {
        name: 'Priority',
        options: [{ value: 'low', label: 'Low' }],
        sort_order: 1,
        updated_at: new Date()
      });
      expect(updated!.options).toEqual([{ value: 'low', label: 'Low' }]);

      const deleted = await db.catalog.deleteEnum(workspace, created.id);
      expect(deleted!.id).toBe(created.id);
    });
  });

  describe('entities', () => {
    it('creates and reads an entity with owner/lifecycle/schema names joined in', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);

      const created = await createFixtureCatalogEntity(db, workspace, schema, {
        tags: ['a', 'b'],
        data: { team: 'payments' }
      });

      expect(created.schema_name).toBeTruthy();
      expect(created.owner_name).toBeNull();
      expect(created.lifecycle_label).toBeNull();
      expect(created.tags).toEqual(['a', 'b']);
      expect(created.data).toEqual({ team: 'payments' });
      expect(created.created_at).toBeInstanceOf(Date);

      const fetched = await db.catalog.getEntity(workspace, created.id);
      expect(fetched!.schema_name).toBe(created.schema_name);

      const byPublicId = await db.catalog.getEntity(workspace, created.public_id);
      expect(byPublicId!.id).toBe(created.id);
    });

    it('updates an entity and returns the response shape identical to getEntity', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const created = await createFixtureCatalogEntity(db, workspace, schema);

      const updated = await db.catalog.updateEntity(workspace, created.id, {
        slug: created.slug,
        namespace: created.namespace,
        name: 'renamed entity',
        description: created.description,
        owner: null,
        lifecycle: null,
        target_lifecycle: null,
        target_lifecycle_date: null,
        tags: ['updated'],
        links: [],
        schema_id: schema,
        data: {},
        visibility_mode: null,
        updated_at: new Date()
      });

      const fetched = await db.catalog.getEntity(workspace, created.id);
      expect(updated).toEqual(fetched);
      expect(updated!.name).toBe('renamed entity');
    });

    it('soft-deletes an entity, clearing owner/lifecycle references', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const created = await createFixtureCatalogEntity(db, workspace, schema);

      const deleted = await db.catalog.deleteEntity(workspace, created.id);
      expect(deleted!.id).toBe(created.id);

      expect(await db.catalog.getEntity(workspace, created.id)).toBeNull();
    });

    it('paginates entities with limit/offset and filters by schema', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schemaA = await createFixtureSchema(db, workspace);
      const schemaB = await createFixtureSchema(db, workspace);

      for (let i = 0; i < 5; i++) {
        await createFixtureCatalogEntity(db, workspace, schemaA, { name: `A-entity-${i}` });
      }
      await createFixtureCatalogEntity(db, workspace, schemaB, { name: 'B-entity' });

      const firstPage = await db.catalog.listEntitiesPaginated(
        workspace,
        { schemaId: schemaA },
        { limit: 2, offset: 0 }
      );
      const secondPage = await db.catalog.listEntitiesPaginated(
        workspace,
        { schemaId: schemaA },
        { limit: 2, offset: 2 }
      );

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(2);
      expect(firstPage.every(e => e.schema_id === schemaA)).toBe(true);
      expect(new Set([...firstPage, ...secondPage].map(e => e.id)).size).toBe(4);

      const all = await db.catalog.listEntitiesPaginated(workspace, {}, { limit: 100, offset: 0 });
      expect(all).toHaveLength(6);
    });

    it('rejects invalid pagination limit/offset values', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      await expect(
        db.catalog.listEntitiesPaginated(workspace, {}, { limit: 0, offset: 0 })
      ).rejects.toThrow();
      await expect(
        db.catalog.listEntitiesPaginated(workspace, {}, { limit: -1, offset: 0 })
      ).rejects.toThrow();
      await expect(
        db.catalog.listEntitiesPaginated(workspace, {}, { limit: 1.5, offset: 0 })
      ).rejects.toThrow();
      await expect(
        db.catalog.listEntitiesPaginated(workspace, {}, { limit: NaN, offset: 0 })
      ).rejects.toThrow();
      await expect(
        db.catalog.listEntitiesPaginated(workspace, {}, { limit: 10, offset: -1 })
      ).rejects.toThrow();
      await expect(
        db.catalog.listEntitiesPaginated(workspace, {}, { limit: 10, offset: 1.5 })
      ).rejects.toThrow();
    });
  });

    it('should ignore prototype property names in filter conditions', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      await createFixtureCatalogEntity(db, workspace, schema, { name: 'Test Entity' });

      // Test various prototype properties - should not cause SQL errors
      const prototypeProps = ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf'];

      for (const prop of prototypeProps) {
        const result = await db.catalog.listEntitiesPaginated(
          workspace,
          { conditions: [{ fieldId: prop, op: 'equals', value: 'test' }] },
          { limit: 10, offset: 0 }
        );
        // Should return all entities (condition ignored) without SQL error
        expect(result).toHaveLength(1);
      }
    });

    it('should handle mixed valid and prototype property filters', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      await createFixtureCatalogEntity(db, workspace, schema, { name: 'Match' });
      await createFixtureCatalogEntity(db, workspace, schema, { name: 'NoMatch' });

      // Mix valid filter with prototype property - should only apply valid filter
      const result = await db.catalog.listEntitiesPaginated(
        workspace,
        {
          conditions: [
            { fieldId: '_name', op: 'equals', value: 'Match' },
            { fieldId: 'toString', op: 'equals', value: 'ignored' }
          ]
        },
        { limit: 10, offset: 0 }
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Match');
    });

    it('filters entities by _tags conditions', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      await createFixtureCatalogEntity(db, workspace, schema, {
        name: 'React entity',
        tags: ['react', 'frontend']
      });
      await createFixtureCatalogEntity(db, workspace, schema, {
        name: 'Vue entity',
        tags: ['vue', 'frontend']
      });
      await createFixtureCatalogEntity(db, workspace, schema, { name: 'Untagged entity', tags: [] });

      const equalsResult = await db.catalog.listEntitiesPaginated(
        workspace,
        { conditions: [{ fieldId: '_tags', op: 'equals', value: 'react' }] },
        { limit: 10, offset: 0 }
      );
      expect(equalsResult.map(e => e.name)).toEqual(['React entity']);

      const notEqualsResult = await db.catalog.listEntitiesPaginated(
        workspace,
        { conditions: [{ fieldId: '_tags', op: 'not_equals', value: 'react' }] },
        { limit: 10, offset: 0 }
      );
      expect(notEqualsResult.map(e => e.name).sort()).toEqual(['Untagged entity', 'Vue entity']);

      const containsResult = await db.catalog.listEntitiesPaginated(
        workspace,
        { conditions: [{ fieldId: '_tags', op: 'contains', value: 'ont' }] },
        { limit: 10, offset: 0 }
      );
      expect(containsResult.map(e => e.name).sort()).toEqual(['React entity', 'Vue entity']);

      const emptyResult = await db.catalog.listEntitiesPaginated(
        workspace,
        { conditions: [{ fieldId: '_tags', op: 'empty', value: '' }] },
        { limit: 10, offset: 0 }
      );
      expect(emptyResult.map(e => e.name)).toEqual(['Untagged entity']);

      const notEmptyResult = await db.catalog.listEntitiesPaginated(
        workspace,
        { conditions: [{ fieldId: '_tags', op: 'not_empty', value: '' }] },
        { limit: 10, offset: 0 }
      );
      expect(notEmptyResult.map(e => e.name).sort()).toEqual(['React entity', 'Vue entity']);
    });


  describe('entity grants', () => {
    it('replaces entity grants atomically', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureCatalogEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const first = await db.catalog.replaceEntityGrants(workspace, entity.id, [
        {
          id: randomUUID(),
          workspace,
          entity_id: entity.id,
          principal_type: 'user',
          principal_id: user.id,
          role: 'viewer',
          applies_to: 'self',
          created_at: new Date()
        }
      ]);
      expect(first).toHaveLength(1);

      const second = await db.catalog.replaceEntityGrants(workspace, entity.id, []);
      expect(second).toEqual([]);
      expect(await db.catalog.getEntityGrants(workspace, entity.id)).toEqual([]);
    });
  });

  describe('pinned entities', () => {
    it('pins, lists and unpins an entity, idempotently', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureCatalogEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      await db.catalog.createPinnedEntity({
        user_id: user.id,
        workspace,
        entity_id: entity.id,
        created_at: new Date()
      });
      await db.catalog.createPinnedEntity({
        user_id: user.id,
        workspace,
        entity_id: entity.id,
        created_at: new Date()
      });

      const pinned = await db.catalog.listPinnedEntities(user.id, workspace);
      expect(pinned).toHaveLength(1);

      const unpinned = await db.catalog.deletePinnedEntity(user.id, workspace, entity.id);
      expect(unpinned!.entity_id).toBe(entity.id);
      expect(await db.catalog.getPinnedEntity(user.id, workspace, entity.id)).toBeNull();
    });
  });

  describe('entity snapshots', () => {
    it('creates snapshots and lists them for an entity', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureCatalogEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const created = await db.catalog.createSnapshot({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        status: 'autosave',
        project_id: null,
        target_date: null,
        commit_message: null,
        created_at: new Date(),
        created_by: user.id,
        created_by_name: user.display_name,
        base_state: { name: entity.name },
        proposed_state: null
      });

      expect(created.created_by_name).toBe(user.display_name);
      expect(created.base_state).toEqual({ name: entity.name });

      const listed = await db.catalog.listSnapshots(workspace, entity.id);
      expect(listed.map(s => s.id)).toContain(created.id);
    });

    it('prunes autosave snapshots, keeping only the N most recent', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureCatalogEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const snapshot = await db.catalog.createSnapshot({
          id: randomUUID(),
          workspace,
          entity_id: entity.id,
          status: 'autosave',
          project_id: null,
          target_date: null,
          commit_message: null,
          created_at: new Date(Date.now() + i * 1000),
          created_by: user.id,
          created_by_name: user.display_name,
          base_state: {},
          proposed_state: null
        });
        ids.push(snapshot.id);
      }

      await db.catalog.pruneAutosaveSnapshots(workspace, entity.id, 2);

      const remaining = await db.catalog.listSnapshots(workspace, entity.id);
      expect(remaining).toHaveLength(2);
      expect(remaining.map(s => s.id).sort()).toEqual(ids.slice(-2).sort());
    });

    it('promotes an autosave snapshot to a saved version', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureCatalogEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const snapshot = await db.catalog.createSnapshot({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        status: 'autosave',
        project_id: null,
        target_date: null,
        commit_message: null,
        created_at: new Date(),
        created_by: user.id,
        created_by_name: user.display_name,
        base_state: {},
        proposed_state: null
      });

      const promoted = await db.catalog.promoteSnapshot(workspace, snapshot.id, 'v1 release');
      expect(promoted!.status).toBe('saved_version');
      expect(promoted!.commit_message).toBe('v1 release');

      expect(await db.catalog.promoteSnapshot(workspace, snapshot.id, 'again')).toBeNull();
    });

    it('updates, then applies, a future_update snapshot', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureCatalogEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);

      const snapshot = await db.catalog.createSnapshot({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        status: 'future_update',
        project_id: project.id,
        target_date: '2030-01-01',
        commit_message: null,
        created_at: new Date(),
        created_by: user.id,
        created_by_name: user.display_name,
        base_state: {},
        proposed_state: { name: 'future name' }
      });

      const updated = await db.catalog.updateSnapshot(workspace, snapshot.id, {
        commit_message: 'planned change'
      });
      expect(updated!.commit_message).toBe('planned change');
      expect(updated!.proposed_state).toEqual({ name: 'future name' });

      const byProject = await db.catalog.listSnapshotsByProject(workspace, project.id);
      expect(byProject.map(s => s.id)).toEqual([snapshot.id]);

      const applied = await db.catalog.applySnapshot(workspace, snapshot.id);
      expect(applied!.status).toBe('applied');
    });

    it('lists entity ids with any real (non future-only) snapshot history', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entityWithHistory = await createFixtureCatalogEntity(db, workspace, schema);
      const entityFutureOnly = await createFixtureCatalogEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      await db.catalog.createSnapshot({
        id: randomUUID(),
        workspace,
        entity_id: entityWithHistory.id,
        status: 'autosave',
        project_id: null,
        target_date: null,
        commit_message: null,
        created_at: new Date(),
        created_by: user.id,
        created_by_name: user.display_name,
        base_state: {},
        proposed_state: null
      });
      await db.catalog.createSnapshot({
        id: randomUUID(),
        workspace,
        entity_id: entityFutureOnly.id,
        status: 'future_update',
        project_id: null,
        target_date: '2030-01-01',
        commit_message: null,
        created_at: new Date(),
        created_by: user.id,
        created_by_name: user.display_name,
        base_state: {},
        proposed_state: {}
      });

      const withHistory = await db.catalog.listEntityIdsWithAnySnapshot(workspace, [
        entityWithHistory.id,
        entityFutureOnly.id
      ]);
      expect(withHistory).toEqual([entityWithHistory.id]);
    });

    it('lists timeline markers grouped by date and type', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureCatalogEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      await db.catalog.createSnapshot({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        status: 'future_update',
        project_id: null,
        target_date: '2030-06-15',
        commit_message: null,
        created_at: new Date(),
        created_by: user.id,
        created_by_name: user.display_name,
        base_state: {},
        proposed_state: {}
      });

      const markers = await db.catalog.listTimelineMarkers(workspace);
      expect(markers).toHaveLength(1);
      expect(markers[0]!.type).toBe('future_update');
      expect(markers[0]!.count).toBe(1);
      expect(markers[0]!.date).toContain('2030-06-15');
    });
  });

  describe('saved views', () => {
    it('creates, updates and deletes a saved view with JSON filters round-tripped', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.view.createSavedView({
        id: randomUUID(),
        workspace,
        project_id: null,
        project_scope: null,
        name: 'My view',
        description: null,
        is_admin_view: false,
        view_mode: 'table',
        filters: { schemaId: 's1', q: 'search' },
        config: null,
        created_at: new Date(),
        updated_at: new Date()
      });

      expect(created.filters).toEqual({ schemaId: 's1', q: 'search' });
      expect(created.is_admin_view).toBe(false);

      const updated = await db.view.updateSavedView(workspace, created.id, {
        name: 'Renamed view',
        filters: { q: 'new search' },
        updated_at: new Date()
      });
      expect(updated!.name).toBe('Renamed view');
      expect(updated!.filters).toEqual({ q: 'new search' });

      const deleted = await db.view.deleteSavedView(workspace, created.id);
      expect(deleted!.id).toBe(created.id);
      expect(await db.view.getSavedView(workspace, created.id)).toBeNull();
    });

    it('lists workspace-level views separately from project-scoped views', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const project = await createFixtureProject(db, workspace);

      await db.view.createSavedView({
        id: randomUUID(),
        workspace,
        project_id: null,
        project_scope: null,
        name: 'Workspace view',
        description: null,
        is_admin_view: false,
        view_mode: 'table',
        filters: {},
        config: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      await db.view.createSavedView({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        project_scope: 'project',
        name: 'Project view',
        description: null,
        is_admin_view: false,
        view_mode: 'table',
        filters: {},
        config: null,
        created_at: new Date(),
        updated_at: new Date()
      });

      const workspaceOnly = await db.view.listSavedViews(workspace);
      expect(workspaceOnly.map(v => v.name)).toEqual(['Workspace view']);

      const projectAndWorkspace = await db.view.listSavedViews(workspace, {
        projectId: project.id,
        includeWorkspace: true
      });
      expect(projectAndWorkspace.map(v => v.name).sort()).toEqual(
        ['Project view', 'Workspace view'].sort()
      );
    });
  });
});
