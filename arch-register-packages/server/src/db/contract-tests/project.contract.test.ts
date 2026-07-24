import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { DatabaseError } from '../database';
import {
  createFixtureEntity,
  createFixtureProject,
  createFixtureWorkspace,
  createFullFixtureSet
} from './projectFixtures';

runContractSuiteAgainstBothDrivers('ProjectDatabase', getDb => {
  describe('project CRUD', () => {
    it('creates and reads back a project with normalized types', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const created = await createFixtureProject(db, workspace);

      expect(created.created_at).toBeInstanceOf(Date);
      expect(created.updated_at).toBeInstanceOf(Date);
      expect(created.pinned).toBe(false);
      expect(created.target_date).toBeNull();
      expect(created.color).toBeNull();

      const fetched = await db.project.getProject(workspace, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.created_at).toBeInstanceOf(Date);
    });

    it('updates a project and reflects the change on read', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const created = await createFixtureProject(db, workspace);

      const updated = await db.project.updateProject(workspace, created.id, {
        name: created.name,
        description: 'updated description',
        owner: null,
        status: 'complete',
        color: '#ff0000',
        target_date: '2030-01-01',
        pinned: true,
        updated_at: new Date()
      });

      expect(updated).not.toBeNull();
      expect(updated!.description).toBe('updated description');
      expect(updated!.status).toBe('complete');
      expect(updated!.pinned).toBe(true);
      expect(updated!.target_date).toBe('2030-01-01');
    });

    it('returns null after deleting a project', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const created = await createFixtureProject(db, workspace);

      await db.project.deleteProject(workspace, created.id);

      expect(await db.project.getProject(workspace, created.id)).toBeNull();
    });

    it('normalizes a duplicate-id insert to a unique DatabaseError', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const created = await createFixtureProject(db, workspace);

      await expect(
        db.project.createProject({
          id: created.id,
          workspace,
          name: 'a different name',
          description: '',
          owner: null,
          status: 'active',
          color: null,
          target_date: null,
          pinned: false,
          created_at: new Date(),
          updated_at: new Date()
        })
      ).rejects.toMatchObject({ code: 'unique' } satisfies Partial<DatabaseError>);
    });
  });

  describe('content node tree', () => {
    it('upserts a content node with normalized boolean/JSON fields', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();

      const node = await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/diagram.dgrm',
        name: 'diagram.dgrm',
        type: 'diagram',
        size_bytes: 100,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      expect(node.is_template).toBe(false);
      expect(node.is_workspace_template).toBe(false);
      expect(node.metadata_keywords).toEqual([]);
      expect(node.created_at).toBeInstanceOf(Date);
    });

    it('updates the same content node in place on repeated upsert', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();

      await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/doc.md',
        name: 'doc.md',
        type: 'markdown',
        size_bytes: 10,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });
      await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/doc.md',
        name: 'doc.md',
        type: 'markdown',
        size_bytes: 20,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      const nodes = await db.project.listContentNodes(workspace, project);
      expect(nodes.filter(n => n.path === '/doc.md')).toHaveLength(1);
      expect(nodes.find(n => n.path === '/doc.md')!.size_bytes).toBe(20);
    });

    it('createContentNodeIfAbsent returns null when a node already exists at the path', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();
      const input = {
        workspace,
        project_id: project,
        path: '/existing.md',
        name: 'existing.md',
        type: 'markdown' as const,
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      };

      const first = await db.project.createContentNodeIfAbsent(input);
      const second = await db.project.createContentNodeIfAbsent(input);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });

    it('renames a folder and its children consistently', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();

      const folder = await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/folder',
        name: 'folder',
        type: 'folder',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });
      await db.project.upsertContentNode({
        workspace,
        project_id: project,
        parent_id: folder.id,
        path: '/folder/child.md',
        name: 'child.md',
        type: 'markdown',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      await db.project.renameContentNodeFolder(workspace, project, '/folder', '/renamed', now);

      expect(await db.project.getContentNodeByPath(workspace, project, '/folder')).toBeNull();
      expect(
        await db.project.getContentNodeByPath(workspace, project, '/renamed/child.md')
      ).not.toBeNull();
    });

    it('deletes a folder and cascades to its children', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();

      const folder = await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/todelete',
        name: 'todelete',
        type: 'folder',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });
      await db.project.upsertContentNode({
        workspace,
        project_id: project,
        parent_id: folder.id,
        path: '/todelete/child.md',
        name: 'child.md',
        type: 'markdown',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      const deleted = await db.project.deleteContentNodeFolder(workspace, project, '/todelete');
      expect(deleted.length).toBeGreaterThanOrEqual(2);

      const remaining = await db.project.listContentNodes(workspace, project);
      expect(remaining.some(n => n.path.startsWith('/todelete'))).toBe(false);
    });
  });

  describe('markdown revisions', () => {
    it('assigns sequential revision numbers', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();
      const node = await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/notes.md',
        name: 'notes.md',
        type: 'markdown',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      const first = await db.project.getNextMarkdownRevisionNumber(workspace, node.id);
      await db.project.createMarkdownRevision({
        workspace,
        node_id: node.id,
        revision_number: first,
        title: null,
        body: 'v1',
        created_at: now,
        created_by: null
      });
      const second = await db.project.getNextMarkdownRevisionNumber(workspace, node.id);

      expect(second).toBe(first + 1);

      const revisions = await db.project.listMarkdownRevisions(workspace, node.id);
      expect(revisions.map(r => r.revision_number)).toEqual([first]);
    });
  });

  describe('content metadata', () => {
    it('round-trips keyword arrays through JSON storage', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();
      const node = await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/withmeta.md',
        name: 'withmeta.md',
        type: 'markdown',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      await db.project.upsertContentMetadata({
        workspace,
        node_id: node.id,
        title: 'Title',
        description: 'Description',
        company: null,
        category: null,
        keywords: ['alpha', 'beta'],
        updated_at: now
      });

      const withMeta = await db.project.getContentNodeById(workspace, project, node.id);
      expect(withMeta!.metadata_keywords).toEqual(['alpha', 'beta']);

      await db.project.deleteContentMetadata(workspace, node.id);
      const cleared = await db.project.getContentNodeById(workspace, project, node.id);
      expect(cleared!.metadata_keywords ?? []).toEqual([]);
    });
  });

  describe('project entities', () => {
    it('normalizes is_done as a boolean and updates in place', async () => {
      const db = getDb();
      const { workspace, project, entity } = await createFullFixtureSet(db);
      const now = new Date();

      const created = await db.project.addProjectEntity({
        workspace,
        project_id: project,
        entity_id: entity,
        entity_type_id: null,
        is_done: false,
        created_at: now
      });
      expect(created.is_done).toBe(false);

      const updated = await db.project.updateProjectEntity(workspace, project, entity, null, true);
      expect(updated!.is_done).toBe(true);
    });

    it('lists projects containing an entity with project metadata in one projection', async () => {
      const db = getDb();
      const { workspace, project, entity } = await createFullFixtureSet(db);
      await db.project.addProjectEntity({
        workspace,
        project_id: project,
        entity_id: entity,
        entity_type_id: null,
        created_at: new Date()
      });

      const rows = await db.project.getEntityProjects(workspace, entity);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        project: { id: project, workspace },
        file_count: 0,
        entity_type_id: null,
        entity_type_label: null
      });
    });

    it('rejects a duplicate project/entity link as a unique DatabaseError', async () => {
      const db = getDb();
      const { workspace, project, entity } = await createFullFixtureSet(db);
      const now = new Date();

      await db.project.addProjectEntity({
        workspace,
        project_id: project,
        entity_id: entity,
        entity_type_id: null,
        is_done: false,
        created_at: now
      });

      await expect(
        db.project.addProjectEntity({
          workspace,
          project_id: project,
          entity_id: entity,
          entity_type_id: null,
          is_done: false,
          created_at: now
        })
      ).rejects.toMatchObject({ code: 'unique' } satisfies Partial<DatabaseError>);
    });

    it('treats removing a non-existent link as a no-op', async () => {
      const db = getDb();
      const { workspace, project, entity } = await createFullFixtureSet(db);

      await expect(
        db.project.removeProjectEntity(workspace, project, entity)
      ).resolves.not.toThrow();
    });
  });

  describe('diagram entity refs', () => {
    it('replaces the ref set idempotently on re-sync', async () => {
      const db = getDb();
      const { workspace, project, schema } = await createFullFixtureSet(db);
      const now = new Date();

      const diagramFile = await db.project.upsertContentNode({
        workspace,
        project_id: project,
        path: '/refs.dgrm',
        name: 'refs.dgrm',
        type: 'diagram',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      const entityA = await createFixtureEntity(db, workspace, schema);
      const entityB = await createFixtureEntity(db, workspace, schema);

      await db.project.syncDiagramEntityRefs(workspace, diagramFile.id, [entityA.id]);
      let filesForA = await db.project.getEntityDiagramFiles(workspace, entityA.id);
      expect(filesForA.map(f => f.file_id)).toEqual([diagramFile.id]);

      await db.project.syncDiagramEntityRefs(workspace, diagramFile.id, [entityB.id]);
      filesForA = await db.project.getEntityDiagramFiles(workspace, entityA.id);
      const filesForB = await db.project.getEntityDiagramFiles(workspace, entityB.id);
      expect(filesForA).toEqual([]);
      expect(filesForB.map(f => f.file_id)).toEqual([diagramFile.id]);
    });
  });

  describe('assessments', () => {
    it('round-trips JSON columns (scope, scope_conditions, fields)', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();

      const created = await db.project.createAssessment({
        id: randomUUID(),
        workspace,
        project_id: project,
        name: 'Security review',
        description: '',
        status: 'draft',
        scope: ['entity-1', 'entity-2'],
        scope_conditions: [],
        fields: [],
        created_at: now,
        updated_at: now
      });

      expect(created.scope).toEqual(['entity-1', 'entity-2']);
      expect(created.scope_conditions).toEqual([]);
      expect(created.fields).toEqual([]);

      const fetched = await db.project.getAssessmentById(workspace, created.id);
      expect(fetched!.scope).toEqual(['entity-1', 'entity-2']);
    });
  });

  describe('project milestones', () => {
    it('creates, updates, and deletes a milestone', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();

      const created = await db.project.createMilestone({
        id: randomUUID(),
        workspace,
        project_id: project,
        name: 'Q3 platform migration',
        target_date: '2030-07-01',
        status: 'planned',
        sort_order: 0,
        created_at: now,
        updated_at: now
      });

      expect(created.status).toBe('planned');
      expect(created.target_date).toBe('2030-07-01');

      const updated = await db.project.updateMilestone(workspace, project, created.id, {
        name: 'Q3 platform migration',
        target_date: '2030-08-01',
        status: 'active',
        sort_order: 1,
        updated_at: new Date()
      });
      expect(updated!.status).toBe('active');
      expect(updated!.target_date).toBe('2030-08-01');
      expect(updated!.sort_order).toBe(1);

      const deleted = await db.project.deleteMilestone(workspace, project, created.id);
      expect(deleted!.id).toBe(created.id);
      expect(await db.project.getMilestone(workspace, project, created.id)).toBeNull();
    });

    it('rejects a duplicate milestone name within the same project as a unique DatabaseError', async () => {
      const db = getDb();
      const { workspace, project } = await createFullFixtureSet(db);
      const now = new Date();

      await db.project.createMilestone({
        id: randomUUID(),
        workspace,
        project_id: project,
        name: 'Launch',
        target_date: '2030-01-01',
        status: 'planned',
        sort_order: 0,
        created_at: now,
        updated_at: now
      });

      await expect(
        db.project.createMilestone({
          id: randomUUID(),
          workspace,
          project_id: project,
          name: 'Launch',
          target_date: '2030-02-01',
          status: 'planned',
          sort_order: 0,
          created_at: now,
          updated_at: now
        })
      ).rejects.toMatchObject({ code: 'unique' } satisfies Partial<DatabaseError>);
    });

    it('reports whether an entity is linked to a project via project_entity', async () => {
      const db = getDb();
      const { workspace, project, entity } = await createFullFixtureSet(db);

      expect(await db.project.isEntityLinkedToProject(workspace, project, entity)).toBe(false);

      await db.project.addProjectEntity({
        workspace,
        project_id: project,
        entity_id: entity,
        entity_type_id: null,
        is_done: false,
        created_at: new Date()
      });

      expect(await db.project.isEntityLinkedToProject(workspace, project, entity)).toBe(true);
    });
  });

  describe('assessment responses', () => {
    it('upserts in place and keeps the count stable', async () => {
      const db = getDb();
      const { workspace, project, entity } = await createFullFixtureSet(db);
      const now = new Date();

      const assessment = await db.project.createAssessment({
        id: randomUUID(),
        workspace,
        project_id: project,
        name: 'Responses assessment',
        description: '',
        status: 'open',
        scope: [],
        scope_conditions: [],
        fields: [],
        created_at: now,
        updated_at: now
      });

      await db.project.upsertAssessmentResponse({
        workspace,
        assessment_id: assessment.id,
        entity_id: entity,
        values: { q1: 'yes' },
        updated_by: null
      });
      await db.project.upsertAssessmentResponse({
        workspace,
        assessment_id: assessment.id,
        entity_id: entity,
        values: { q1: 'no' },
        updated_by: null
      });

      const count = await db.project.countAssessmentResponses(workspace, assessment.id);
      expect(count).toBe(1);

      const response = await db.project.getAssessmentResponse(workspace, assessment.id, entity);
      expect(response!.values).toEqual({ q1: 'no' });
    });
  });

  describe('transactions', () => {
    it('commits all writes made inside a successful transaction', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const idA = randomUUID();
      const idB = randomUUID();

      await db.core.transaction(async tx => {
        await createFixtureProject(tx, workspace, idA);
        await createFixtureProject(tx, workspace, idB);
      });

      expect(await db.project.getProject(workspace, idA)).not.toBeNull();
      expect(await db.project.getProject(workspace, idB)).not.toBeNull();
    });

    it('rolls back all writes when the transaction callback throws', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const survivingId = randomUUID();

      await expect(
        db.core.transaction(async tx => {
          await createFixtureProject(tx, workspace, survivingId);
          // Duplicate id triggers a unique-constraint violation, which should roll back
          // the entire transaction, including the first (otherwise-valid) insert above.
          await createFixtureProject(tx, workspace, survivingId);
        })
      ).rejects.toThrow();

      expect(await db.project.getProject(workspace, survivingId)).toBeNull();
    });
  });

  describe('error normalization', () => {
    it('normalizes a foreign-key violation to code "foreign"', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const now = new Date();

      await expect(
        db.project.upsertContentNode({
          workspace,
          project_id: randomUUID(),
          path: '/orphan.md',
          name: 'orphan.md',
          type: 'markdown',
          size_bytes: 0,
          comment_count: 0,
          unresolved_comment_count: 0,
          updated_at: now,
          created_atIfNew: now
        })
      ).rejects.toMatchObject({ code: 'foreign' } satisfies Partial<DatabaseError>);
    });
  });
});
