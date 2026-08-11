import { randomUUID } from 'node:crypto';
import { expect, test } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';

const workspace = 'default';
const workspaceId = seedIds.workspace.default;

test.describe('field migrations across schema domains', () => {
  test('renames entity schema data and records the shared migration summary', async ({
    orpc,
    server
  }) => {
    const suffix = randomUUID();
    const schema = await orpc.schemas.create({
      params: { workspace },
      body: {
        name: `Entity migration ${suffix}`,
        fields: [{ id: 'legacy_code', name: 'Legacy code', type: 'text' }]
      }
    });
    const entity = await orpc.entities.create({
      params: { workspace },
      body: { _schemaId: schema.id, _name: 'Migrated entity', legacy_code: 'before' } as never
    });

    const nextFields = [{ id: 'current_code', name: 'Legacy code', type: 'text' as const }];
    await expect(
      orpc.schemas.update({
        params: { workspace, id: schema.id },
        body: { name: schema.name, fields: nextFields }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await orpc.schemas.update({
      params: { workspace, id: schema.id },
      body: {
        name: schema.name,
        fields: nextFields,
        fieldMigrations: { legacy_code: { action: 'rename', renameTo: 'current_code' } }
      }
    });

    const stored = await server.db.catalog.getEntity(workspaceId, entity._uid);
    expect(stored?.data).toEqual({ current_code: 'before' });
    const versions = await orpc.schemas.listVersions({ params: { workspace, id: schema.id } });
    expect(versions[0]?.changeSummary).toEqual({
      added: ['Legacy code'],
      renamed: [{ from: 'Legacy code', to: 'Legacy code' }]
    });
  });

  test('renames relation data through the relation schema executor', async ({ orpc, server }) => {
    const suffix = randomUUID();
    const endpointSchema = await orpc.schemas.create({
      params: { workspace },
      body: { name: `Relation endpoint ${suffix}` }
    });
    const inEntity = await orpc.entities.create({
      params: { workspace },
      body: { _schemaId: endpointSchema.id, _name: `Relation source ${suffix}` } as never
    });
    const outEntity = await orpc.entities.create({
      params: { workspace },
      body: { _schemaId: endpointSchema.id, _name: `Relation target ${suffix}` } as never
    });
    const relationSchema = await orpc.relationSchemas.create({
      params: { workspace },
      body: {
        name: `Relation migration ${suffix}`,
        in: { schemaIds: [endpointSchema.id] },
        out: { schemaIds: [endpointSchema.id] },
        fields: [{ id: 'legacy_note', name: 'Legacy note', type: 'text' }]
      }
    });
    const relation = await server.db.relation.createRelation({
      id: randomUUID(),
      workspace: workspaceId,
      schema_id: relationSchema.id,
      in_entity_id: inEntity._uid,
      out_entity_id: outEntity._uid,
      data: { legacy_note: 'before' },
      created_at: new Date(),
      updated_at: new Date()
    });
    const nextFields = [{ id: 'current_note', name: 'Legacy note', type: 'text' as const }];

    await expect(
      orpc.relationSchemas.update({
        params: { workspace, id: relationSchema.id },
        body: {
          name: relationSchema.name,
          in: { schemaIds: [endpointSchema.id] },
          out: { schemaIds: [endpointSchema.id] },
          fields: nextFields
        }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await orpc.relationSchemas.update({
      params: { workspace, id: relationSchema.id },
      body: {
        name: relationSchema.name,
        in: { schemaIds: [endpointSchema.id] },
        out: { schemaIds: [endpointSchema.id] },
        fields: nextFields,
        fieldMigrations: { legacy_note: { action: 'rename', renameTo: 'current_note' } }
      }
    });

    const stored = await server.db.relation.getRelation(workspaceId, relation.id);
    expect(stored?.data).toEqual({ current_note: 'before' });
    const versions = await orpc.relationSchemas.listVersions({
      params: { workspace, id: relationSchema.id }
    });
    expect(versions[0]?.changeSummary).toEqual({
      added: ['Legacy note'],
      renamed: [{ from: 'Legacy note', to: 'Legacy note' }]
    });
  });

  test('renames document template metadata when a document type field is migrated', async ({
    orpc
  }) => {
    const suffix = randomUUID();
    const documentType = await orpc.documents.documentTypes.create({
      params: { workspace },
      body: {
        name: `Document migration ${suffix}`,
        description: '',
        fields: [
          { id: 'legacy_status', name: 'Legacy status', type: 'text', requirement: 'optional' }
        ]
      }
    });
    await orpc.documents.documentTemplates.create({
      params: { workspace },
      body: {
        name: `Template ${suffix}`,
        body: '# Document',
        document_type_id: documentType.id,
        metadata_defaults: { legacy_status: 'draft' },
        project_id: null
      }
    });
    const nextFields = [
      {
        id: 'current_status',
        name: 'Legacy status',
        type: 'text' as const,
        requirement: 'optional' as const
      }
    ];

    await expect(
      orpc.documents.documentTypes.update({
        params: { workspace, id: documentType.id },
        body: { name: documentType.name, description: '', fields: nextFields }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await orpc.documents.documentTypes.update({
      params: { workspace, id: documentType.id },
      body: {
        name: documentType.name,
        description: '',
        fields: nextFields,
        fieldMigrations: { legacy_status: { action: 'rename', renameTo: 'current_status' } }
      }
    });

    const templates = await orpc.documents.documentTemplates.list({
      params: { workspace },
      query: { include_archived: false }
    });
    expect(templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata_defaults: { current_status: 'draft' } })
      ])
    );
    const versions = await orpc.documents.documentTypes.listVersions({
      params: { workspace, id: documentType.id }
    });
    expect(versions[0]?.changeSummary).toEqual({
      added: ['Legacy status'],
      renamed: [{ from: 'Legacy status', to: 'Legacy status' }]
    });
  });

  test('renames shared fieldgroup data across its including schema', async ({ orpc, server }) => {
    const suffix = randomUUID();
    const group = await orpc.fieldGroups.create({
      params: { workspace },
      body: {
        name: `Shared migration ${suffix}`,
        fields: [{ id: 'legacy_owner', name: 'Legacy owner', type: 'text' }]
      }
    });
    const schema = await orpc.schemas.create({
      params: { workspace },
      body: {
        name: `Shared migration schema ${suffix}`,
        shared_field_group_links: [{ groupId: group.id }]
      }
    });
    const entity = await orpc.entities.create({
      params: { workspace },
      body: {
        _schemaId: schema.id,
        _name: 'Shared migration entity',
        legacy_owner: 'before'
      } as never
    });
    const nextFields = [{ id: 'current_owner', name: 'Legacy owner', type: 'text' as const }];

    await expect(
      orpc.fieldGroups.update({
        params: { workspace, id: group.id },
        body: { name: group.name, fields: nextFields }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await orpc.fieldGroups.update({
      params: { workspace, id: group.id },
      body: {
        name: group.name,
        fields: nextFields,
        fieldMigrations: { legacy_owner: { action: 'rename', renameTo: 'current_owner' } }
      }
    });

    const stored = await server.db.catalog.getEntity(workspaceId, entity._uid);
    expect(stored?.data).toEqual({ current_owner: 'before' });
    const refreshed = await orpc.schemas.get({ params: { workspace, id: schema.id } });
    expect(refreshed.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'current_owner' })])
    );
    const versions = await orpc.schemas.listVersions({ params: { workspace, id: schema.id } });
    expect(versions[0]?.changeSummary).toEqual({
      added: ['Legacy owner'],
      renamed: [{ from: 'Legacy owner', to: 'Legacy owner' }]
    });
  });
});
