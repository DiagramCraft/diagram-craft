import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { DatabaseError, type DatabaseAdapter } from '../database';
import {
  createFixtureProject,
  createFixtureSchema,
  createFixtureWorkspace
} from '../testSupport/fixtures';
import { createFixtureUser } from '../testSupport/fixtures';
import { createFixtureEntity } from '../testSupport/fixtures';

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
        category: 'Architecture',
        description: 'updated',
        fields: [],
        templates: [
          {
            id: 'vendor',
            name: 'Vendor',
            values: { tags: ['third-party'], fields: {} }
          }
        ],
        color: '#ff0000',
        icon: null,
        default_owner: null,
        key_prefix: fetched!.key_prefix,
        updated_at: new Date()
      });
      expect(updated!.name).toBe('renamed schema');
      expect(updated!.category).toBe('Architecture');
      expect(updated!.templates).toEqual([
        {
          id: 'vendor',
          name: 'Vendor',
          values: { tags: ['third-party'], fields: {} }
        }
      ]);

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

  describe('schema versioning and field migrations', () => {
    it('bumps version on update and leaves it unchanged when omitted', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const id = await createFixtureSchema(db, workspace);
      const created = (await db.catalog.getSchema(workspace, id))!;
      expect(created.version).toBe(1);

      const updatedNoVersion = await db.catalog.updateSchema(workspace, id, {
        name: created.name,
        description: created.description,
        fields: [],
        templates: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: created.key_prefix,
        updated_at: new Date()
      });
      expect(updatedNoVersion!.version).toBe(1);

      const updatedWithVersion = await db.catalog.updateSchema(workspace, id, {
        name: created.name,
        description: created.description,
        fields: [],
        templates: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: created.key_prefix,
        version: 2,
        updated_at: new Date()
      });
      expect(updatedWithVersion!.version).toBe(2);
    });

    it('creates and lists schema versions newest first', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const id = await createFixtureSchema(db, workspace);
      const user = await createFixtureUser(db);

      await db.catalog.createSchemaVersion({
        id: randomUUID(),
        workspace,
        schema_id: id,
        version: 1,
        name: 'Component',
        category: 'Core',
        description: '',
        fields: [],
        templates: [],
        groups: [],
        color: null,
        icon: null,
        change_summary: { added: ['name'] },
        created_by: user.id,
        created_at: new Date('2026-01-01T00:00:00.000Z')
      });
      await db.catalog.createSchemaVersion({
        id: randomUUID(),
        workspace,
        schema_id: id,
        version: 2,
        name: 'Component',
        category: null,
        description: '',
        fields: [{ id: 'owner', name: 'Owner', type: 'text' }],
        templates: [],
        groups: [],
        color: null,
        icon: null,
        change_summary: { added: ['owner'] },
        created_by: user.id,
        created_at: new Date('2026-01-02T00:00:00.000Z')
      });

      const versions = await db.catalog.listSchemaVersions(workspace, id);
      expect(versions.map(v => v.version)).toEqual([2, 1]);
      expect(versions[0]!.change_summary).toEqual({ added: ['owner'] });
      expect(versions.map(version => version.category)).toEqual([null, 'Core']);
      expect(versions[0]!.created_by).toBe(user.id);
    });

    it('renames a field across all entities for the schema atomically', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schemaId = await createFixtureSchema(db, workspace);
      const otherSchemaId = await createFixtureSchema(db, workspace);

      const entity1 = await createFixtureEntity(db, workspace, schemaId, {
        data: { old_field: 'a', other: 1 }
      });
      const entity2 = await createFixtureEntity(db, workspace, schemaId, {
        data: { other: 2 }
      });
      const entityOtherSchema = await createFixtureEntity(db, workspace, otherSchemaId, {
        data: { old_field: 'should-not-change' }
      });

      const affected = await db.catalog.renameEntityDataField(
        workspace,
        schemaId,
        'old_field',
        'new_field'
      );
      expect(affected).toBe(1);

      const updated1 = await db.catalog.getEntity(workspace, entity1.id);
      expect(updated1!.data).toEqual({ new_field: 'a', other: 1 });

      const updated2 = await db.catalog.getEntity(workspace, entity2.id);
      expect(updated2!.data).toEqual({ other: 2 });

      const untouched = await db.catalog.getEntity(workspace, entityOtherSchema.id);
      expect(untouched!.data).toEqual({ old_field: 'should-not-change' });
    });

    it('removes a field from every entity data blob for the schema', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schemaId = await createFixtureSchema(db, workspace);

      const entity1 = await createFixtureEntity(db, workspace, schemaId, {
        data: { doomed: 'x', keep: 1 }
      });
      const entity2 = await createFixtureEntity(db, workspace, schemaId, {
        data: { keep: 2 }
      });

      const affected = await db.catalog.removeEntityDataField(workspace, schemaId, 'doomed');
      expect(affected).toBe(1);

      expect((await db.catalog.getEntity(workspace, entity1.id))!.data).toEqual({ keep: 1 });
      expect((await db.catalog.getEntity(workspace, entity2.id))!.data).toEqual({ keep: 2 });
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

      const created = await createFixtureEntity(db, workspace, schema, {
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
      const created = await createFixtureEntity(db, workspace, schema);

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
        project_id: null,
        updated_at: new Date(),
        completeness: 0
      });

      const fetched = await db.catalog.getEntity(workspace, created.id);
      expect(updated).toEqual(fetched);
      expect(updated!.name).toBe('renamed entity');
    });

    it('soft-deletes an entity, clearing owner/lifecycle references', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const created = await createFixtureEntity(db, workspace, schema);

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
        await createFixtureEntity(db, workspace, schemaA, { name: `A-entity-${i}` });
      }
      await createFixtureEntity(db, workspace, schemaB, { name: 'B-entity' });

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
    await createFixtureEntity(db, workspace, schema, { name: 'Test Entity' });

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
    await createFixtureEntity(db, workspace, schema, { name: 'Match' });
    await createFixtureEntity(db, workspace, schema, { name: 'NoMatch' });

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
    await createFixtureEntity(db, workspace, schema, {
      name: 'React entity',
      tags: ['react', 'frontend']
    });
    await createFixtureEntity(db, workspace, schema, {
      name: 'Vue entity',
      tags: ['vue', 'frontend']
    });
    await createFixtureEntity(db, workspace, schema, { name: 'Untagged entity', tags: [] });

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

  describe('project_id scoping', () => {
    it('excludes project-exclusive entities from global (unscoped) listings', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const project = (await createFixtureProject(db, workspace)).id;
      await createFixtureEntity(db, workspace, schema, { name: 'Global entity' });
      await createFixtureEntity(db, workspace, schema, {
        name: 'Project-exclusive entity',
        project_id: project
      });

      const globalResult = await db.catalog.listEntitiesPaginated(
        workspace,
        {},
        { limit: 10, offset: 0 }
      );
      expect(globalResult.map(e => e.name)).toEqual(['Global entity']);
    });

    it('includes project-exclusive entities and project_entity-linked entities when scoped to that project', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const project = (await createFixtureProject(db, workspace)).id;
      const otherProject = (await createFixtureProject(db, workspace)).id;
      const globalEntity = await createFixtureEntity(db, workspace, schema, {
        name: 'Global entity'
      });
      const exclusiveEntity = await createFixtureEntity(db, workspace, schema, {
        name: 'Project-exclusive entity',
        project_id: project
      });
      const linkedEntity = await createFixtureEntity(db, workspace, schema, {
        name: 'Linked entity'
      });
      await createFixtureEntity(db, workspace, schema, {
        name: 'Other project entity',
        project_id: otherProject
      });
      await db.project.addProjectEntity({
        workspace,
        project_id: project,
        entity_id: linkedEntity.id,
        entity_type_id: null,
        created_at: new Date()
      });

      const scopedResult = await db.catalog.listEntitiesPaginated(
        workspace,
        { projectId: project, projectScope: 'project' },
        { limit: 10, offset: 0 }
      );
      expect(scopedResult.map(e => e.id).sort()).toEqual(
        [exclusiveEntity.id, linkedEntity.id].sort()
      );

      const allProjectResult = await db.catalog.listEntitiesPaginated(
        workspace,
        { projectId: project, projectScope: 'all' },
        { limit: 10, offset: 0 }
      );
      expect(allProjectResult.map(e => e.id).sort()).toEqual(
        [globalEntity.id, exclusiveEntity.id, linkedEntity.id].sort()
      );
    });
  });

  describe('entity grants', () => {
    it('replaces entity grants atomically', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const first = await db.catalog.replaceEntityGrants(workspace, entity.id, [
        {
          id: randomUUID(),
          workspace,
          entity_id: entity.id,
          principal_type: 'user',
          principal_id: user.id,
          role: 'editor',
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
      const entity = await createFixtureEntity(db, workspace, schema);
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

  describe('entity version history', () => {
    it('prunes autosave versions, keeping only the N most recent', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const version = await db.catalog.createEntityVersion({
          id: randomUUID(),
          workspace,
          record_id: entity.id,
          version_number: i + 1,
          kind: 'autosave',
          commit_message: null,
          created_at: new Date(Date.now() + i * 1000),
          created_by: user.id,
          state: {},
          applied_case_revision_id: null
        });
        ids.push(version.id);
      }

      await db.catalog.pruneAutosaveVersions(workspace, entity.id, 2);

      const remaining = await db.catalog.listEntityVersions(workspace, entity.id);
      expect(remaining).toHaveLength(2);
      expect(remaining.map(v => v.id).sort()).toEqual(ids.slice(-2).sort());
    });

    it('lists entity ids with any real (non future-only) version history', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entityWithHistory = await createFixtureEntity(db, workspace, schema);
      const entityFutureOnly = await createFixtureEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);

      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: entityWithHistory.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: new Date(),
        created_by: user.id,
        state: {},
        applied_case_revision_id: null
      });
      await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: '2030-01-01',
        milestone_id: null,
        message: null,
        created_by: user.id,
        created_at: new Date(),
        members: [
          {
            entity_id: entityFutureOnly.id,
            base_version: 1,
            base_state: {},
            proposed_state: {},
            diff: {}
          }
        ]
      });

      const withHistory = await db.catalog.listEntityIdsWithVersionHistory(workspace, [
        entityWithHistory.id,
        entityFutureOnly.id
      ]);
      expect(withHistory).toEqual([entityWithHistory.id]);
    });

    it('lists planned entity changes as of a date, scoped to active case revisions', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);

      const futureCase = await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: '2030-01-01',
        milestone_id: null,
        message: null,
        created_by: user.id,
        created_at: new Date(),
        members: [
          {
            entity_id: entity.id,
            base_version: 1,
            base_state: {},
            proposed_state: { name: 'Planned Name' },
            diff: {}
          }
        ]
      });

      const beforeEffectiveDate = await db.catalog.listPlannedEntityChangesAsOf(
        workspace,
        new Date('2029-01-01T00:00:00.000Z'),
        [entity.id]
      );
      expect(beforeEffectiveDate).toHaveLength(0);

      const afterEffectiveDate = await db.catalog.listPlannedEntityChangesAsOf(
        workspace,
        new Date('2030-06-01T00:00:00.000Z'),
        [entity.id]
      );
      expect(afterEffectiveDate).toHaveLength(1);
      expect(afterEffectiveDate[0]?.entity_id).toBe(entity.id);
      expect(afterEffectiveDate[0]?.project_id).toBe(project.id);
      expect(afterEffectiveDate[0]?.target_date).toBe('2030-01-01');
      expect(afterEffectiveDate[0]?.proposed_state).toEqual({ name: 'Planned Name' });
      expect(afterEffectiveDate[0]?.case_id).toBe(futureCase.id);
    });

    it('resolves milestone dates when listing planned changes as of a date', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);
      const milestone = await db.project.createMilestone({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: 'Q2 milestone',
        target_date: '2030-06-01',
        status: 'planned',
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: null,
        milestone_id: milestone.id,
        message: null,
        created_by: user.id,
        created_at: new Date(),
        members: [
          {
            entity_id: entity.id,
            base_version: 1,
            base_state: {},
            proposed_state: { name: 'Milestone Name' },
            diff: {}
          }
        ]
      });

      const beforeMilestone = await db.catalog.listPlannedEntityChangesAsOf(
        workspace,
        new Date('2030-05-01T00:00:00.000Z'),
        [entity.id]
      );
      expect(beforeMilestone).toHaveLength(0);

      const onMilestone = await db.catalog.listPlannedEntityChangesAsOf(
        workspace,
        new Date('2030-06-01T00:00:00.000Z'),
        [entity.id]
      );
      expect(onMilestone).toHaveLength(1);
      expect(onMilestone[0]?.milestone_id).toBe(milestone.id);
    });

    it('excludes open approval proposals from planned entity changes', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const now = new Date();

      await db.entityChange.createApproval({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        status: 'open',
        initiator_user_id: null,
        created_at: now,
        updated_at: now,
        closed_at: null
      });
      const approval = (await db.entityChange.listApprovals(workspace, 'open'))[0]!;
      await db.entityChange.createApprovalRevision({
        id: randomUUID(),
        proposal_id: approval.id,
        workspace,
        entity_id: entity.id,
        revision_number: 1,
        base_version: 1,
        base_state: { id: entity.id },
        proposed_state: { name: 'Unapproved Name' },
        diff: { name: 'Unapproved Name' },
        policy_version: '1',
        resolved_policy: {},
        message: null,
        created_by: null,
        status: 'submitted',
        created_at: now,
        resolved_at: null
      });

      const result = await db.catalog.listPlannedEntityChangesAsOf(
        workspace,
        new Date(Date.now() + 60_000),
        [entity.id]
      );
      expect(result).toHaveLength(0);
    });

    it('excludes relation members from an unscoped listPlannedEntityChangesAsOf', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const inEntity = await createFixtureEntity(db, workspace, schema);
      const outEntity = await createFixtureEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);
      const now = new Date();

      const relationSchemaId = randomUUID();
      await db.relation.createRelationSchema({
        id: relationSchemaId,
        workspace,
        name: `Relation schema ${relationSchemaId}`,
        description: '',
        in_schema_ids: [schema],
        out_schema_ids: [schema],
        fields: [],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: inEntity.id,
        out_entity_id: outEntity.id,
        data: {},
        created_at: now,
        updated_at: now
      });

      await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: '2030-01-01',
        milestone_id: null,
        message: null,
        created_by: user.id,
        created_at: now,
        members: [
          {
            entity_id: entity.id,
            base_version: 1,
            base_state: {},
            proposed_state: { name: 'Planned Name' },
            diff: {}
          },
          {
            entity_id: relation.id,
            base_version: 1,
            base_state: {},
            proposed_state: { data: { note: 'after' } },
            diff: {}
          }
        ]
      });

      const changes = await db.catalog.listPlannedEntityChangesAsOf(
        workspace,
        new Date('2030-06-01T00:00:00.000Z')
      );
      expect(changes.map(c => c.entity_id)).toEqual([entity.id]);
    });

    it('lists timeline markers grouped by date and type', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);

      await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: '2030-06-15',
        milestone_id: null,
        message: null,
        created_by: user.id,
        created_at: new Date(),
        members: [
          { entity_id: entity.id, base_version: 1, base_state: {}, proposed_state: {}, diff: {} }
        ]
      });

      const markers = await db.catalog.listTimelineMarkers(workspace);
      expect(markers).toHaveLength(1);
      expect(markers[0]!.type).toBe('future_update');
      expect(markers[0]!.count).toBe(1);
      expect(markers[0]!.date).toContain('2030-06-15');
    });

    it('excludes relation version rows from an unscoped listEntityVersionsAsOf', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const inEntity = await createFixtureEntity(db, workspace, schema);
      const outEntity = await createFixtureEntity(db, workspace, schema);
      const now = new Date();

      const relationSchemaId = randomUUID();
      await db.relation.createRelationSchema({
        id: relationSchemaId,
        workspace,
        name: `Relation schema ${relationSchemaId}`,
        description: '',
        in_schema_ids: [schema],
        out_schema_ids: [schema],
        fields: [],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: inEntity.id,
        out_entity_id: outEntity.id,
        data: {},
        created_at: now,
        updated_at: now
      });
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: relation.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: now,
        created_by: null,
        state: { schema_id: relationSchemaId, data: {} },
        applied_case_revision_id: null
      });
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: entity.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: now,
        created_by: null,
        state: { schema_id: schema, data: {} },
        applied_case_revision_id: null
      });

      // An unscoped call (no candidateEntityIds — the workspace-wide asOf browser/landscape-diff
      // path) must return the entity's version row but never the relation's.
      const versions = await db.catalog.listEntityVersionsAsOf(workspace, new Date());
      expect(versions.map(v => v.record_id)).toEqual([entity.id]);
    });

    it('excludes relation ids from an unscoped listEntityIdsWithVersionHistory', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const inEntity = await createFixtureEntity(db, workspace, schema);
      const outEntity = await createFixtureEntity(db, workspace, schema);
      const now = new Date();

      const relationSchemaId = randomUUID();
      await db.relation.createRelationSchema({
        id: relationSchemaId,
        workspace,
        name: `Relation schema ${relationSchemaId}`,
        description: '',
        in_schema_ids: [schema],
        out_schema_ids: [schema],
        fields: [],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: inEntity.id,
        out_entity_id: outEntity.id,
        data: {},
        created_at: now,
        updated_at: now
      });
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: relation.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: now,
        created_by: null,
        state: { schema_id: relationSchemaId, data: {} },
        applied_case_revision_id: null
      });
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: entity.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: now,
        created_by: null,
        state: { schema_id: schema, data: {} },
        applied_case_revision_id: null
      });

      const withHistory = await db.catalog.listEntityIdsWithVersionHistory(workspace);
      expect(withHistory).toEqual([entity.id]);
    });

    it('counts a change case whose only member is a relation instance', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const inEntity = await createFixtureEntity(db, workspace, schema);
      const outEntity = await createFixtureEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);
      const now = new Date();

      const relationSchemaId = randomUUID();
      await db.relation.createRelationSchema({
        id: relationSchemaId,
        workspace,
        name: `Relation schema ${relationSchemaId}`,
        description: '',
        in_schema_ids: [schema],
        out_schema_ids: [schema],
        fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: inEntity.id,
        out_entity_id: outEntity.id,
        data: {},
        created_at: now,
        updated_at: now
      });

      await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: '2031-03-10',
        milestone_id: null,
        message: null,
        created_by: user.id,
        created_at: now,
        members: [
          {
            entity_id: relation.id,
            base_version: 1,
            base_state: {},
            proposed_state: {},
            diff: {}
          }
        ]
      });

      const markers = await db.catalog.listTimelineMarkers(workspace);
      expect(markers).toHaveLength(1);
      expect(markers[0]!.type).toBe('future_update');
      expect(markers[0]!.count).toBe(1);
      expect(markers[0]!.date).toContain('2031-03-10');
    });

    it('reassigns cases off a milestone, backfilling the effective date', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);
      const now = new Date();

      const milestone = await db.project.createMilestone({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: 'Q1 migration',
        target_date: '2031-01-01',
        status: 'planned',
        sort_order: 0,
        created_at: now,
        updated_at: now
      });

      const changeCase = await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: null,
        milestone_id: milestone.id,
        message: null,
        created_by: user.id,
        created_at: now,
        members: [
          { entity_id: entity.id, base_version: 1, base_state: {}, proposed_state: {}, diff: {} }
        ]
      });

      await db.catalog.reassignSnapshotsFromMilestone(
        workspace,
        milestone.id,
        milestone.target_date
      );

      const reloaded = await db.changeCase.getCase(workspace, changeCase.id);
      expect(reloaded!.milestone_id).toBeNull();
      expect(reloaded!.effective_date).toBe('2031-01-01');
    });
  });

  describe('relation version history', () => {
    const setupRelation = async (db: DatabaseAdapter, workspace: string, schema: string) => {
      const inEntity = await createFixtureEntity(db, workspace, schema);
      const outEntity = await createFixtureEntity(db, workspace, schema);
      const now = new Date();
      const relationSchemaId = randomUUID();
      await db.relation.createRelationSchema({
        id: relationSchemaId,
        workspace,
        name: `Relation schema ${relationSchemaId}`,
        description: '',
        in_schema_ids: [schema],
        out_schema_ids: [schema],
        fields: [],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: inEntity.id,
        out_entity_id: outEntity.id,
        data: {},
        created_at: now,
        updated_at: now
      });
      return { relation, relationSchemaId, inEntity, outEntity };
    };

    it('lists relation version rows as of a date, excluding entity versions', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const { relation } = await setupRelation(db, workspace, schema);
      const now = new Date();

      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: relation.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: now,
        created_by: null,
        state: { schema_id: relation.schema_id, data: {} },
        applied_case_revision_id: null
      });
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: entity.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: now,
        created_by: null,
        state: { schema_id: schema, data: {} },
        applied_case_revision_id: null
      });

      const versions = await db.catalog.listRelationVersionsAsOf(workspace, new Date());
      expect(versions.map(v => v.record_id)).toEqual([relation.id]);
    });

    it('lists planned relation changes as of a date, excluding entity members', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const { relation } = await setupRelation(db, workspace, schema);
      const project = await createFixtureProject(db, workspace);
      const user = await createFixtureUser(db);
      const now = new Date();

      await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: '2030-01-01',
        milestone_id: null,
        message: null,
        created_by: user.id,
        created_at: now,
        members: [
          {
            entity_id: entity.id,
            base_version: 1,
            base_state: {},
            proposed_state: { name: 'Planned Name' },
            diff: {}
          },
          {
            entity_id: relation.id,
            base_version: 1,
            base_state: {},
            proposed_state: { data: { note: 'after' } },
            diff: {}
          }
        ]
      });

      const changes = await db.catalog.listPlannedRelationChangesAsOf(
        workspace,
        new Date('2030-06-01T00:00:00.000Z')
      );
      expect(changes.map(c => c.entity_id)).toEqual([relation.id]);
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
        filters: {
          schemaId: 's1',
          root: { kind: 'and', children: [] }
        },
        config: null,
        created_at: new Date(),
        updated_at: new Date()
      });

      expect(created.filters).toEqual({
        schemaId: 's1',
        root: { kind: 'and', children: [] }
      });
      expect(created.is_admin_view).toBe(false);

      const updated = await db.view.updateSavedView(workspace, created.id, {
        name: 'Renamed view',
        filters: {
          schemaId: 's1',
          root: { kind: 'and', children: [] }
        },
        updated_at: new Date()
      });
      expect(updated!.name).toBe('Renamed view');
      expect(updated!.filters).toEqual({
        schemaId: 's1',
        root: { kind: 'and', children: [] }
      });

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
        filters: { root: { kind: 'and', children: [] } },
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
        filters: { root: { kind: 'and', children: [] } },
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

  describe('entity collections', () => {
    it('supports private collections, multiple memberships and idempotent membership changes', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const firstUser = await createFixtureUser(db);
      const secondUser = await createFixtureUser(db);
      const now = new Date();

      const first = await db.view.createCollection({
        id: randomUUID(),
        workspace,
        user_id: firstUser.id,
        name: 'Important systems',
        created_at: now,
        updated_at: now
      });
      const second = await db.view.createCollection({
        id: randomUUID(),
        workspace,
        user_id: firstUser.id,
        name: 'Important systems',
        created_at: now,
        updated_at: now
      });

      await db.view.addCollectionEntity(firstUser.id, workspace, first.id, entity.id, now);
      await db.view.addCollectionEntity(firstUser.id, workspace, first.id, entity.id, now);
      await db.view.addCollectionEntity(firstUser.id, workspace, second.id, entity.id, now);

      const visibleToOwner = await db.view.listCollections(firstUser.id, workspace, entity.id);
      expect(visibleToOwner.map(collection => collection.name)).toEqual([
        'Important systems',
        'Important systems'
      ]);
      expect(visibleToOwner.every(collection => collection.is_member)).toBe(true);
      expect(visibleToOwner.every(collection => collection.entity_count === 1)).toBe(true);
      expect(await db.view.listCollectionEntityIds(firstUser.id, workspace, first.id)).toEqual([
        entity.id
      ]);

      expect(await db.view.listCollections(secondUser.id, workspace)).toEqual([]);
      expect(
        await db.view.removeCollectionEntity(firstUser.id, workspace, first.id, entity.id)
      ).toMatchObject({
        collection_id: first.id,
        entity_id: entity.id
      });
      expect(await db.view.listCollectionEntityIds(firstUser.id, workspace, first.id)).toEqual([]);

      await db.view.deleteCollection(firstUser.id, workspace, second.id);
      expect(await db.view.getCollection(firstUser.id, workspace, second.id)).toBeNull();
      expect(await db.catalog.getEntity(workspace, entity.id)).not.toBeNull();
    });
  });
});
