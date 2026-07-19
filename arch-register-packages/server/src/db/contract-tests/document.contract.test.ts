import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureProject,
  createFixtureSchema,
  createFixtureWorkspace
} from './projectFixtures';
import { createFixtureUser } from './authFixtures';
import type { DatabaseAdapter } from '../database';

runContractSuiteAgainstBothDrivers('DocumentDatabase', getDb => {
  const createType = async (
    db: DatabaseAdapter,
    workspace: string,
    name = 'Architecture Decision Record'
  ) => {
    const now = new Date();
    return db.document.createDocumentType({
      id: randomUUID(),
      workspace,
      name,
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
      color: 'oklch(0.62 0.14 295)',
      icon: 'clipboard',
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
    expect(type.color).toBe('oklch(0.62 0.14 295)');
    expect(type.icon).toBe('clipboard');
    const updatedType = await db.document.updateDocumentType(workspace, type.id, {
      name: type.name,
      description: type.description,
      fields: type.fields,
      color: 'oklch(0.66 0.16 258)',
      icon: 'api',
      updated_at: new Date()
    });
    expect(updatedType).toMatchObject({ color: 'oklch(0.66 0.16 258)', icon: 'api' });
    expect((await db.document.listDocumentTemplates(workspace, project.id))[0]?.id).toBe(
      template.id
    );

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
      expect.objectContaining({
        node_id: nodeId,
        field_id: 'affected_entities',
        target_id: entity.id
      })
    ]);

    await db.document.deleteDocumentMetadata(workspace, nodeId);
    expect(await db.document.listDocumentsLinkingEntity(workspace, entity.id)).toEqual([]);

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

  it('round-trips interactive AI actions on create and update, defaulting to empty', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const defaultType = await createType(db, workspace, 'Untyped Actions');
    expect(defaultType.aiActions).toEqual([]);

    const now = new Date();
    const type = await db.document.createDocumentType({
      id: randomUUID(),
      workspace,
      name: 'Runbook',
      description: 'A runbook',
      fields: [],
      color: null,
      icon: null,
      aiActions: [
        {
          id: 'summarize',
          name: 'Summarize',
          kind: 'interactive',
          prompt: 'Summarize this.',
          enabled: true
        }
      ],
      created_at: now,
      updated_at: now
    });
    expect(type.aiActions).toEqual([
      {
        id: 'summarize',
        name: 'Summarize',
        kind: 'interactive',
        prompt: 'Summarize this.',
        enabled: true
      }
    ]);

    const updated = await db.document.updateDocumentType(workspace, type.id, {
      name: type.name,
      description: type.description,
      fields: type.fields,
      aiActions: [
        {
          id: 'summarize',
          name: 'Summarize v2',
          kind: 'interactive',
          prompt: 'Summarize this document.',
          enabled: false
        }
      ],
      updated_at: new Date()
    });
    expect(updated?.aiActions).toEqual([
      {
        id: 'summarize',
        name: 'Summarize v2',
        kind: 'interactive',
        prompt: 'Summarize this document.',
        enabled: false
      }
    ]);
    expect((await db.document.getDocumentType(workspace, type.id))?.aiActions).toEqual(
      updated?.aiActions
    );
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

  it('round-trips an inverse field label and resolves document-to-document backlinks', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const now = new Date();

    const type = await db.document.createDocumentType({
      id: randomUUID(),
      workspace,
      name: 'Architecture Decision Record',
      description: 'A decision record',
      fields: [
        {
          id: 'supersedes',
          name: 'Supersedes',
          type: 'document_link',
          requirement: 'optional',
          minCardinality: 0,
          inverseName: 'Superseded by',
          retired: false
        }
      ],
      color: null,
      icon: null,
      created_at: now,
      updated_at: now
    });
    expect(type.fields[0]?.inverseName).toBe('Superseded by');

    const reread = await db.document.getDocumentType(workspace, type.id);
    expect(reread?.fields[0]?.inverseName).toBe('Superseded by');

    const olderNodeId = randomUUID();
    const newerNodeId = randomUUID();
    for (const [nodeId, name] of [
      [olderNodeId, 'ADR-1'],
      [newerNodeId, 'ADR-2']
    ] as const) {
      await db.project.upsertContentNode({
        id: nodeId,
        workspace,
        project_id: project.id,
        entity_id: null,
        parent_id: null,
        path: `adr/${nodeId}.md`,
        name,
        type: 'markdown',
        size_bytes: 12,
        comment_count: 0,
        unresolved_comment_count: 0,
        created_atIfNew: now,
        updated_at: now
      });
    }

    await db.document.upsertDocumentMetadata({
      workspace,
      node_id: newerNodeId,
      document_type_id: type.id,
      values: { supersedes: [olderNodeId] },
      updated_at: now
    });
    await db.document.replaceDocumentLinks(workspace, newerNodeId, [
      { field_id: 'supersedes', target_type: 'document', target_id: olderNodeId, position: 0 }
    ]);

    expect(await db.document.listDocumentsLinkingDocument(workspace, olderNodeId)).toEqual([
      expect.objectContaining({
        node_id: newerNodeId,
        field_id: 'supersedes',
        target_type: 'document',
        target_id: olderNodeId
      })
    ]);
    expect(await db.document.listDocumentsLinkingDocument(workspace, newerNodeId)).toEqual([]);
  });

  it('bumps document type version on update and leaves it unchanged when omitted', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const type = await createType(db, workspace);
    expect(type.version).toBe(1);

    const updatedNoVersion = await db.document.updateDocumentType(workspace, type.id, {
      name: type.name,
      description: type.description,
      fields: type.fields,
      color: type.color,
      icon: type.icon,
      updated_at: new Date()
    });
    expect(updatedNoVersion!.version).toBe(1);

    const updatedWithVersion = await db.document.updateDocumentType(workspace, type.id, {
      name: type.name,
      description: type.description,
      fields: type.fields,
      color: type.color,
      icon: type.icon,
      version: 2,
      updated_at: new Date()
    });
    expect(updatedWithVersion!.version).toBe(2);
  });

  it('creates and lists document type versions newest first', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const type = await createType(db, workspace);
    const user = await createFixtureUser(db);

    await db.document.createDocumentTypeVersion({
      id: randomUUID(),
      workspace,
      document_type_id: type.id,
      version: 1,
      name: type.name,
      description: type.description,
      fields: type.fields,
      color: type.color,
      icon: type.icon,
      change_summary: { added: ['status', 'affected_entities'] },
      created_by: user.id,
      created_at: new Date('2026-01-01T00:00:00.000Z')
    });
    await db.document.createDocumentTypeVersion({
      id: randomUUID(),
      workspace,
      document_type_id: type.id,
      version: 2,
      name: type.name,
      description: type.description,
      fields: [
        ...type.fields,
        { id: 'owner', name: 'Owner', type: 'text', requirement: 'optional', retired: false }
      ],
      color: type.color,
      icon: type.icon,
      change_summary: { added: ['owner'] },
      created_by: user.id,
      created_at: new Date('2026-01-02T00:00:00.000Z')
    });

    const versions = await db.document.listDocumentTypeVersions(workspace, type.id);
    expect(versions.map(v => v.version)).toEqual([2, 1]);
    expect(versions[0]!.change_summary).toEqual({ added: ['owner'] });
    expect(versions[0]!.created_by).toBe(user.id);
  });

  it('renames a field across content_node_document values for the document type atomically', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const type = await createType(db, workspace);
    const otherType = await createType(db, workspace, 'Other type');
    const now = new Date();

    const makeNode = async (path: string) => {
      const nodeId = randomUUID();
      await db.project.upsertContentNode({
        id: nodeId,
        workspace,
        project_id: project.id,
        entity_id: null,
        parent_id: null,
        path,
        name: path,
        type: 'markdown',
        size_bytes: 12,
        comment_count: 0,
        unresolved_comment_count: 0,
        created_atIfNew: now,
        updated_at: now
      });
      return nodeId;
    };

    const node1 = await makeNode('a.md');
    const node2 = await makeNode('b.md');
    const nodeOtherType = await makeNode('c.md');

    await db.document.upsertDocumentMetadata({
      workspace,
      node_id: node1,
      document_type_id: type.id,
      values: { status: 'proposed', affected_entities: [] },
      updated_at: now
    });
    await db.document.upsertDocumentMetadata({
      workspace,
      node_id: node2,
      document_type_id: type.id,
      values: { affected_entities: [] },
      updated_at: now
    });
    await db.document.upsertDocumentMetadata({
      workspace,
      node_id: nodeOtherType,
      document_type_id: otherType.id,
      values: { status: 'should-not-change' },
      updated_at: now
    });

    const affected = await db.document.renameDocumentMetadataField(
      workspace,
      type.id,
      'status',
      'decision_status'
    );
    expect(affected).toBe(1);

    expect((await db.document.getDocumentMetadata(workspace, node1))!.values).toEqual({
      decision_status: 'proposed',
      affected_entities: []
    });
    expect((await db.document.getDocumentMetadata(workspace, node2))!.values).toEqual({
      affected_entities: []
    });
    expect((await db.document.getDocumentMetadata(workspace, nodeOtherType))!.values).toEqual({
      status: 'should-not-change'
    });
  });

  it('removes a field from every content_node_document values blob for the document type', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const type = await createType(db, workspace);
    const now = new Date();

    const nodeId = randomUUID();
    await db.project.upsertContentNode({
      id: nodeId,
      workspace,
      project_id: project.id,
      entity_id: null,
      parent_id: null,
      path: 'a.md',
      name: 'a.md',
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
      values: { status: 'proposed', affected_entities: ['keep'] },
      updated_at: now
    });

    const affected = await db.document.removeDocumentMetadataField(workspace, type.id, 'status');
    expect(affected).toBe(1);

    expect((await db.document.getDocumentMetadata(workspace, nodeId))!.values).toEqual({
      affected_entities: ['keep']
    });
  });
});
