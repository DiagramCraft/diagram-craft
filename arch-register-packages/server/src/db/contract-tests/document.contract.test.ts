import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureProject,
  createFixtureSchema,
  createFixtureWorkspace
} from './projectFixtures';
import type { DatabaseAdapter } from '../database';

runContractSuiteAgainstBothDrivers('DocumentDatabase', getDb => {
  const createType = async (db: DatabaseAdapter, workspace: string) => {
    const now = new Date();
    return db.document.createDocumentType({
      id: randomUUID(),
      workspace,
      name: 'Architecture Decision Record',
      description: 'A decision record',
      fields: [
        {
          id: 'status',
          name: 'Status',
          type: 'enum',
          requirement: 'required',
          enumOptions: [{ value: 'proposed', label: 'Proposed' }],
          retired: false
        },
        {
          id: 'affected_entities',
          name: 'Affected entities',
          type: 'entity_link',
          requirement: 'optional',
          maxCardinality: 3,
          retired: false
        }
      ],
      created_at: now,
      updated_at: now
    });
  };

  it('round-trips types, templates, metadata, links, and complete revisions', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);
    const entity = await createFixtureEntity(db, workspace, schema);
    const project = await createFixtureProject(db, workspace);
    const type = await createType(db, workspace);
    const now = new Date();

    const template = await db.document.createDocumentTemplate({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'ADR template',
      body: '# {{title}}',
      document_type_id: type.id,
      metadata_defaults: { status: 'proposed' },
      created_at: now,
      updated_at: now
    });
    expect(template.project_id).toBe(project.id);
    expect((await db.document.listDocumentTemplates(workspace, project.id))[0]?.id).toBe(template.id);

    const nodeId = randomUUID();
    await db.project.upsertContentNode({
      id: nodeId,
      workspace,
      project_id: project.id,
      entity_id: null,
      parent_id: null,
      path: 'adr/decision.md',
      name: 'Decision',
      type: 'markdown',
      size_bytes: 12,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: now,
      updated_at: now
    });
    await db.document.upsertDocumentMetadata({
      workspace,
      node_id: nodeId,
      document_type_id: type.id,
      values: { status: 'proposed', affected_entities: [entity.id] },
      updated_at: now
    });
    await db.document.replaceDocumentLinks(workspace, nodeId, [
      { field_id: 'affected_entities', target_type: 'entity', target_id: entity.id, position: 0 }
    ]);
    await db.core.transaction(async tx => {
      await tx.document.replaceDocumentLinks(workspace, nodeId, [
        { field_id: 'affected_entities', target_type: 'entity', target_id: entity.id, position: 0 }
      ]);
    });

    expect(await db.document.getDocumentMetadata(workspace, nodeId)).toMatchObject({
      node_id: nodeId,
      document_type_id: type.id,
      values: { status: 'proposed', affected_entities: [entity.id] }
    });
    expect(await db.document.listDocumentsLinkingEntity(workspace, entity.id)).toEqual([
      expect.objectContaining({ node_id: nodeId, field_id: 'affected_entities', target_id: entity.id })
    ]);

    const revision = await db.project.createMarkdownRevision({
      id: randomUUID(),
      workspace,
      node_id: nodeId,
      revision_number: 1,
      title: 'Decision',
      body: '# Decision',
      created_at: now,
      created_by: null,
      document_type_id: type.id,
      metadata: { status: 'proposed', affected_entities: [entity.id] }
    });
    expect(revision.document_type_id).toBe(type.id);
    expect(revision.metadata).toEqual({ status: 'proposed', affected_entities: [entity.id] });
  });

  it('supports archived definitions without hiding them from explicit reads', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const type = await createType(db, workspace);

    await db.document.archiveDocumentType(workspace, type.id, true, new Date());
    expect(await db.document.listDocumentTypes(workspace)).toEqual([]);
    expect((await db.document.listDocumentTypes(workspace, true))[0]?.archived).toBe(true);
    expect((await db.document.getDocumentType(workspace, type.id))?.archived).toBe(true);
  });
});
