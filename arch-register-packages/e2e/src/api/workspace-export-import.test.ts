import { randomUUID } from 'node:crypto';
import { test, expect } from '../helpers/fixtures';
import { NONEXISTENT_UUID } from '../helpers/testIds';
import { createTestORPCClient } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';
import { hashPassword } from '@arch-register/server/utils/password';

const suggestedResolutions = (parseResult: {
  conflicts: Array<{
    item_id: string;
    suggested_resolution: 'skip' | 'merge' | 'overwrite' | 'rename';
  }>;
}) =>
  Object.fromEntries(
    parseResult.conflicts.map(conflict => [
      conflict.item_id,
      { action: conflict.suggested_resolution }
    ])
  );

test.describe('workspace export/import', () => {
  test('exports and imports workspace capability field mappings', async ({ orpc, server }) => {
    const suffix = randomUUID();
    const source = await orpc.workspaces.create({
      body: { name: `Capability mapping source ${suffix}`, badge: 'CMS' }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: {
        name: `Mapped schema ${suffix}`,
        fields: [
          { id: 'protocol_kind', name: 'Protocol kind', type: 'text' },
          { id: 'contract_version', name: 'Contract version', type: 'text' }
        ]
      }
    });
    await orpc.config.capabilityConfigurations.upsert({
      params: { workspace: source.url_slug, type: 'api-specification' },
      body: {
        bindings: {
          api: {
            target: { kind: 'entity_schema', id: schema.id },
            fieldMappings: { api_type: 'protocol_kind', api_version: 'contract_version' }
          }
        }
      }
    });
    const archive = await orpc.workspaces.export({
      params: { workspace: source.url_slug },
      body: { include: ['config', 'schemas'], options: { include_content: false } }
    });
    const target = await orpc.workspaces.create({
      body: { name: `Capability mapping target ${suffix}`, badge: 'CMT' }
    });
    const parsed = await orpc.workspaces.importParse({
      params: { workspace: target.url_slug },
      body: {
        file: new File([archive.body as Blob], 'capability-mapping-export.zip', {
          type: 'application/zip'
        })
      }
    });
    expect(parsed.valid).toBe(true);
    const execute = await orpc.workspaces.importExecute({
      params: { workspace: target.url_slug },
      body: {
        import_id: (parsed as any).import_id,
        include: ['config', 'schemas'],
        conflict_resolutions: suggestedResolutions(parsed as any),
        options: { preserve_ids: false, update_references: true }
      }
    });
    expect(execute.success).toBe(true);

    const imported = (await server.db.catalog.listSchemas(target.id)).find(
      item => item.name === schema.name
    );
    expect(imported).toBeDefined();
    await expect(
      server.db.workspace.getWorkspaceCapabilityConfiguration(target.id, 'api-specification')
    ).resolves.toMatchObject({
      bindings: {
        api: {
          target: { kind: 'entity_schema', id: imported?.id },
          fieldMappings: { api_type: 'protocol_kind', api_version: 'contract_version' }
        }
      }
    });
  });

  test('exports and imports workspace capability bindings with remapped targets', async ({
    orpc,
    server
  }) => {
    const suffix = randomUUID();
    const source = await orpc.workspaces.create({
      body: { name: `Workspace capability source ${suffix}`, badge: 'WCS' }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: {
        name: `Workspace API schema ${suffix}`,
        fields: [
          { id: 'protocol_kind', name: 'Protocol kind', type: 'text' },
          { id: 'contract_version', name: 'Contract version', type: 'text' }
        ]
      }
    });
    await orpc.config.capabilityConfigurations.upsert({
      params: { workspace: source.url_slug, type: 'api-specification' },
      body: {
        bindings: {
          api: {
            target: { kind: 'entity_schema', id: schema.id },
            fieldMappings: {
              api_type: 'protocol_kind',
              api_version: 'contract_version'
            }
          }
        }
      }
    });

    const archive = await orpc.workspaces.export({
      params: { workspace: source.url_slug },
      body: {
        include: ['config', 'schemas'],
        options: { include_content: false }
      }
    });
    const target = await orpc.workspaces.create({
      body: { name: `Workspace capability target ${suffix}`, badge: 'WCT' }
    });
    const parsed = await orpc.workspaces.importParse({
      params: { workspace: target.url_slug },
      body: {
        file: new File([archive.body as Blob], 'workspace-capability-export.zip', {
          type: 'application/zip'
        })
      }
    });
    expect(parsed.valid).toBe(true);
    expect(parsed.summary.config).toMatchObject({ capability_configurations: 1 });

    const execute = await orpc.workspaces.importExecute({
      params: { workspace: target.url_slug },
      body: {
        import_id: (parsed as any).import_id,
        include: ['config', 'schemas'],
        conflict_resolutions: suggestedResolutions(parsed as any),
        options: { preserve_ids: false, update_references: true }
      }
    });
    expect(execute.success).toBe(true);
    expect(execute.imported.config).toMatchObject({ capability_configurations: 1 });

    const importedSchema = (await server.db.catalog.listSchemas(target.id)).find(
      item => item.name === schema.name
    );
    const importedConfiguration = await server.db.workspace.getWorkspaceCapabilityConfiguration(
      target.id,
      'api-specification'
    );
    expect(importedConfiguration).toMatchObject({
      bindings: {
        api: {
          target: { kind: 'entity_schema', id: importedSchema?.id },
          fieldMappings: { api_type: 'protocol_kind', api_version: 'contract_version' }
        }
      }
    });
  });

  test('replicates workspace capability bindings with remapped schema targets', async ({
    orpc,
    server
  }) => {
    const suffix = randomUUID();
    const source = await orpc.workspaces.create({
      body: { name: `Workspace capability replication source ${suffix}`, badge: 'WRS' }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: {
        name: `Replicated API schema ${suffix}`,
        fields: [
          { id: 'protocol_kind', name: 'Protocol kind', type: 'text' },
          { id: 'contract_version', name: 'Contract version', type: 'text' }
        ]
      }
    });
    await orpc.config.capabilityConfigurations.upsert({
      params: { workspace: source.url_slug, type: 'api-specification' },
      body: {
        bindings: {
          api: {
            target: { kind: 'entity_schema', id: schema.id },
            fieldMappings: { api_type: 'protocol_kind', api_version: 'contract_version' }
          }
        }
      }
    });

    const target = await orpc.workspaces.create({
      body: {
        name: `Workspace capability replication target ${suffix}`,
        badge: 'WRT',
        replicate_from: source.id,
        include: ['schemas', 'settings']
      }
    });
    const targetSchema = (await server.db.catalog.listSchemas(target.id)).find(
      item => item.name === schema.name
    );
    const targetConfiguration = await server.db.workspace.getWorkspaceCapabilityConfiguration(
      target.id,
      'api-specification'
    );

    expect(targetConfiguration).toMatchObject({
      bindings: {
        api: {
          target: { kind: 'entity_schema', id: targetSchema?.id },
          fieldMappings: { api_type: 'protocol_kind', api_version: 'contract_version' }
        }
      }
    });
  });

  test('exports and imports typed relation schemas and remapped relation endpoints', async ({
    orpc,
    server
  }) => {
    const suffix = randomUUID();
    const badgeSuffix = Array.from(suffix.replaceAll('-', '').slice(0, 4), character =>
      String.fromCharCode(65 + Number.parseInt(character, 16))
    ).join('');
    const source = await orpc.workspaces.create({
      body: { name: `Relation export source ${suffix}`, badge: `R${badgeSuffix}` }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: { name: `Relation entity schema ${suffix}`, category: 'Architecture' }
    });
    const inEntity = await orpc.entities.create({
      params: { workspace: source.url_slug },
      body: { _schemaId: schema.id, _name: `Relation source in ${suffix}` } as never
    });
    const outEntity = await orpc.entities.create({
      params: { workspace: source.url_slug },
      body: { _schemaId: schema.id, _name: `Relation source out ${suffix}` } as never
    });
    const relationSchemaId = randomUUID();
    const relationId = randomUUID();
    const now = new Date();
    await server.db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace: source.id,
      name: `Relation schema ${suffix}`,
      category: 'Connectivity',
      description: 'Exported relation schema',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [{ id: 'kind', name: 'Kind', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: '#123456',
      icon: 'link',
      relation_approval_policy: 'disabled',
      version: 1,
      created_at: now,
      updated_at: now
    });
    await server.db.relation.createRelation({
      id: relationId,
      workspace: source.id,
      schema_id: relationSchemaId,
      in_entity_id: inEntity._uid,
      out_entity_id: outEntity._uid,
      data: { kind: 'runtime' },
      version: 1,
      approval_policy_override: null,
      created_at: now,
      updated_at: now
    });

    const archive = await orpc.workspaces.export({
      params: { workspace: source.url_slug },
      body: {
        include: ['schemas', 'relation_schemas', 'entities', 'relations'],
        options: { include_content: false }
      }
    });
    const target = await orpc.workspaces.create({
      body: { name: `Relation import target ${suffix}`, badge: `T${badgeSuffix}` }
    });
    const parsed = await orpc.workspaces.importParse({
      params: { workspace: target.url_slug },
      body: {
        file: new File([archive.body as Blob], 'relations-export.zip', {
          type: 'application/zip'
        })
      }
    });
    expect(parsed.valid).toBe(true);
    expect(parsed.summary.relation_schemas).toEqual({ count: 1, conflicts: 0 });
    expect(parsed.summary.relations).toEqual({ count: 1, conflicts: 0 });

    const execute = await orpc.workspaces.importExecute({
      params: { workspace: target.url_slug },
      body: {
        import_id: (parsed as any).import_id,
        include: ['schemas', 'relation_schemas', 'entities', 'relations'],
        conflict_resolutions: suggestedResolutions(parsed as any),
        options: { preserve_ids: false, update_references: true }
      }
    });
    expect(execute.success).toBe(true);
    expect(execute.imported.relations).toEqual({ created: 1, updated: 0, skipped: 0 });

    const importedEntitySchema = (await server.db.catalog.listSchemas(target.id)).find(
      item => item.name === schema.name
    );
    const importedRelationSchema = (await server.db.relation.listRelationSchemas(target.id)).find(
      item => item.name === `Relation schema ${suffix}`
    );
    expect(importedEntitySchema?.category).toBe('Architecture');
    expect(importedRelationSchema?.category).toBe('Connectivity');

    const targetEntities = await server.db.catalog.listEntities(target.id);
    const targetIn = targetEntities.find(entity => entity.name === inEntity._name);
    const targetOut = targetEntities.find(entity => entity.name === outEntity._name);
    const targetRelations = (
      await server.db.relation.listRelations(
        target.id,
        { schemaId: null, inEntityId: null, outEntityId: null },
        {}
      )
    ).items;
    expect(targetRelations).toHaveLength(1);
    expect(targetRelations[0]).toEqual(
      expect.objectContaining({
        in_entity_id: targetIn?.id,
        out_entity_id: targetOut?.id,
        data: { kind: 'runtime' }
      })
    );
  });

  test('exports and imports a relation schema with a wildcard ("any") endpoint', async ({
    orpc,
    server
  }) => {
    const suffix = randomUUID();
    const badgeSuffix = Array.from(suffix.replaceAll('-', '').slice(0, 4), character =>
      String.fromCharCode(65 + Number.parseInt(character, 16))
    ).join('');
    const source = await orpc.workspaces.create({
      body: { name: `Wildcard relation source ${suffix}`, badge: `R${badgeSuffix}` }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: { name: `Wildcard entity schema ${suffix}` }
    });
    const relationSchemaId = randomUUID();
    const now = new Date();
    await server.db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace: source.id,
      name: `Wildcard relation schema ${suffix}`,
      description: 'Relation schema with an "any entity" endpoint',
      in_schema_ids: [schema.id],
      out_schema_ids: 'any',
      fields: [],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      version: 1,
      created_at: now,
      updated_at: now
    });

    const archive = await orpc.workspaces.export({
      params: { workspace: source.url_slug },
      body: { include: ['schemas', 'relation_schemas'], options: { include_content: false } }
    });
    const target = await orpc.workspaces.create({
      body: { name: `Wildcard relation target ${suffix}`, badge: `T${badgeSuffix}` }
    });
    const parsed = await orpc.workspaces.importParse({
      params: { workspace: target.url_slug },
      body: {
        file: new File([archive.body as Blob], 'wildcard-relation-export.zip', {
          type: 'application/zip'
        })
      }
    });
    expect(parsed.valid).toBe(true);
    expect(parsed.summary.relation_schemas).toEqual({ count: 1, conflicts: 0 });

    const execute = await orpc.workspaces.importExecute({
      params: { workspace: target.url_slug },
      body: {
        import_id: (parsed as any).import_id,
        include: ['schemas', 'relation_schemas'],
        conflict_resolutions: suggestedResolutions(parsed as any),
        options: { preserve_ids: false, update_references: true }
      }
    });
    expect(execute.success).toBe(true);

    const targetRelationSchemas = await server.db.relation.listRelationSchemas(target.id);
    expect(targetRelationSchemas).toHaveLength(1);
    expect(targetRelationSchemas[0]?.out_schema_ids).toBe('any');
  });

  test('exports and imports typed relation CSV rows', async ({ orpc, server }) => {
    const suffix = randomUUID();
    const schemaKeyPrefix = Array.from(suffix.replaceAll('-', '').slice(0, 4), character =>
      String.fromCharCode(65 + Number.parseInt(character, 16))
    ).join('');
    const workspace = await orpc.workspaces.create({
      body: { name: `Relation CSV workspace ${suffix}`, badge: 'RCV' }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: workspace.url_slug },
      body: {
        name: `Relation CSV entity schema ${suffix}`,
        key_prefix: `R${schemaKeyPrefix}`
      }
    });
    const inEntity = await orpc.entities.create({
      params: { workspace: workspace.url_slug },
      body: { _schemaId: schema.id, _name: `CSV source in ${suffix}` } as never
    });
    const outEntity = await orpc.entities.create({
      params: { workspace: workspace.url_slug },
      body: { _schemaId: schema.id, _name: `CSV source out ${suffix}` } as never
    });
    const relationSchemaId = randomUUID();
    const now = new Date();
    await server.db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace: workspace.id,
      name: `Relation CSV type ${suffix}`,
      description: '',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      version: 1,
      created_at: now,
      updated_at: now
    });
    await server.db.relation.createRelation({
      id: randomUUID(),
      workspace: workspace.id,
      schema_id: relationSchemaId,
      in_entity_id: inEntity._uid,
      out_entity_id: outEntity._uid,
      data: { note: 'before' },
      created_at: now,
      updated_at: now
    });

    const exported = await orpc.relations.exportCsv({
      params: { workspace: workspace.url_slug },
      query: {
        relationQuery: JSON.stringify({
          root_kind: 'relation',
          root: { kind: 'and', children: [] }
        }) as never
      }
    });
    const csv = await exported.body.text();
    expect(csv).toContain('_schemaId;_inEntityId;_outEntityId;Note');
    expect(csv).toContain(`${relationSchemaId};${inEntity._uid};${outEntity._uid};before`);

    const parsed = await orpc.relations.importParse({
      params: { workspace: workspace.url_slug },
      body: {
        csvContent: `_schemaId;_inEntityId;_outEntityId;Note\n${relationSchemaId};${inEntity._uid};${outEntity._uid};after`
      }
    });
    expect(parsed.validRows).toBe(1);
    expect(parsed.relations[0]).toMatchObject({ isUpdate: true });

    const committed = await orpc.relations.importCommit({
      params: { workspace: workspace.url_slug },
      body: { relations: parsed.relations.map(row => row.relation!).filter(Boolean) }
    });
    expect(committed).toMatchObject({ created: 0, updated: 1 });

    const relations = (
      await server.db.relation.listRelations(
        workspace.id,
        { schemaId: relationSchemaId, inEntityId: null, outEntityId: null },
        {}
      )
    ).items;
    expect(relations[0]?.data).toEqual({ note: 'after' });
  });

  test('preserves field-group ACLs and hides restricted values after import', async ({
    orpc,
    server
  }) => {
    const suffix = Date.now().toString();
    const source = await orpc.workspaces.create({
      body: { name: `ACL export source ${suffix}`, badge: 'AES' }
    });
    const teams = await orpc.config.teams.list({ params: { workspace: source.url_slug } });
    const group = await orpc.fieldGroups.create({
      params: { workspace: source.url_slug },
      body: {
        name: `Restricted shared group ${suffix}`,
        fields: [{ id: `secret_${suffix}`, name: 'Secret', type: 'text' }]
      }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: {
        name: `ACL export schema ${suffix}`,
        shared_field_group_links: [{ groupId: group.id, teamIds: [teams[0]!.id] }]
      }
    });
    const entity = await orpc.entities.create({
      params: { workspace: source.url_slug },
      body: {
        _schemaId: schema.id,
        _name: `ACL export entity ${suffix}`,
        [`secret_${suffix}`]: 'imported secret'
      } as never
    });

    const archive = await orpc.workspaces.export({
      params: { workspace: source.url_slug },
      body: { include: ['schemas', 'entities'], options: { include_content: false } }
    });
    const target = await orpc.workspaces.create({
      body: { name: `ACL import target ${suffix}`, badge: 'AIT' }
    });
    const targetTeams = await orpc.config.teams.list({ params: { workspace: target.url_slug } });
    const targetGroup = await orpc.fieldGroups.create({
      params: { workspace: target.url_slug },
      body: {
        name: group.name,
        fields: [{ id: `secret_${suffix}`, name: 'Secret', type: 'text' }]
      }
    });
    const targetSchemaId = randomUUID();
    const targetSchemaNow = new Date();
    await server.db.catalog.createSchema({
      id: targetSchemaId,
      workspace: target.id,
      name: schema.name,
      description: '',
      fields: [{ id: `secret_${suffix}`, name: 'Secret', type: 'text', groupId: targetGroup.id }],
      groups: [
        {
          id: targetGroup.id,
          name: targetGroup.name,
          accessControl: { teamIds: [targetTeams[0]!.id] }
        }
      ],
      shared_field_group_links: [{ groupId: targetGroup.id, teamIds: [targetTeams[0]!.id] }],
      templates: [],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: `T${suffix.slice(-4)}`,
      created_at: targetSchemaNow,
      updated_at: targetSchemaNow
    });
    await server.db.workspace.registerPublicIdPrefix(
      `T${suffix.slice(-4)}`,
      'schema',
      targetSchemaId,
      targetSchemaNow
    );
    const parsed = await orpc.workspaces.importParse({
      params: { workspace: target.url_slug },
      body: {
        file: new File([archive.body as Blob], 'acl-export.zip', { type: 'application/zip' })
      }
    });
    const execute = await orpc.workspaces.importExecute({
      params: { workspace: target.url_slug },
      body: {
        import_id: (parsed as any).import_id,
        include: ['schemas', 'entities'],
        conflict_resolutions: suggestedResolutions(parsed as any),
        options: { preserve_ids: false, update_references: true }
      }
    });
    expect(execute.success).toBe(true);
    expect(execute.imported.schemas).toEqual({ created: 0, updated: 1 });

    const importedSchemas = await server.db.catalog.listSchemas(target.id);
    const importedSchema = importedSchemas.find(item => item.name === schema.name);
    expect(importedSchema).toEqual(
      expect.objectContaining({
        groups: expect.arrayContaining([
          expect.objectContaining({ accessControl: { teamIds: expect.any(Array) } })
        ]),
        shared_field_group_links: expect.arrayContaining([
          expect.objectContaining({ teamIds: expect.any(Array) })
        ])
      })
    );
    const importedEntity = (await server.db.catalog.listEntities(target.id)).find(
      item => item.name === entity._name
    );
    expect(importedEntity?.data[`secret_${suffix}`]).toBe('imported secret');

    const now = new Date();
    const viewerId = `00000000-0000-0000-0000-${suffix.slice(-12).padStart(12, '0')}`;
    await server.db.auth.createUser({
      id: viewerId,
      user_id: `acl-import-viewer-${suffix}`,
      email: `acl-import-viewer-${suffix}@e2e.test`,
      display_name: 'ACL import viewer',
      auth_provider: 'local',
      password_hash: await hashPassword('TestPassword123!'),
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      color: null,
      created_at: now,
      updated_at: now,
      last_login_at: null
    });
    await server.db.workspace.setWorkspaceMemberRole(target.id, viewerId, 'viewer', now);
    const viewer = createTestORPCClient(server.baseUrl, await makeAuthHeader(server.db, viewerId));
    const visible = await viewer.entities.get({
      params: { workspace: target.url_slug, id: importedEntity!.id }
    });
    expect(visible).not.toHaveProperty(`secret_${suffix}`);
  });

  test.describe('export', () => {
    test('POST /api/:workspace/export exports workspace with all data types', async ({ orpc }) => {
      const response = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas', 'entities', 'projects', 'content_nodes'],
          options: { include_content: true }
        }
      });

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.zip');
      expect(response.body).toBeInstanceOf(Blob);

      const blob = response.body as Blob;
      expect(blob.size).toBeGreaterThan(0);
    });

    test('POST /api/:workspace/export exports workspace with selected data types', async ({
      orpc
    }) => {
      const response = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['schemas', 'entities'],
          options: { include_content: false }
        }
      });

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.body).toBeInstanceOf(Blob);
    });

    test('POST /api/:workspace/export exports workspace without content files', async ({
      orpc
    }) => {
      const response = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas', 'entities'],
          options: { include_content: false }
        }
      });

      expect(response.body).toBeInstanceOf(Blob);
      const blob = response.body as Blob;
      expect(blob.size).toBeGreaterThan(0);
    });

    test('POST /api/:workspace/export returns 404 for non-existent workspace', async ({ orpc }) => {
      await expect(
        orpc.workspaces.export({
          params: { workspace: NONEXISTENT_UUID },
          body: {
            include: ['config'],
            options: {}
          }
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    test('POST /api/:workspace/export succeeds with proper permissions', async ({ orpc }) => {
      // Create a workspace
      const workspace = await orpc.workspaces.create({ body: { name: 'Export Test Workspace' } });

      // Export with default user who has permissions
      const response = await orpc.workspaces.export({
        params: { workspace: workspace.url_slug },
        body: {
          include: ['config'],
          options: {}
        }
      });

      expect(response.body).toBeInstanceOf(Blob);
    });
  });

  test.describe('import parse', () => {
    test('POST /api/:workspace/import/parse validates and parses import file', async ({ orpc }) => {
      // First export a workspace to get a valid ZIP file
      const exportResponse = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas', 'entities'],
          options: { include_content: false }
        }
      });

      const exportBlob = exportResponse.body as Blob;
      const exportFile = new File([exportBlob], 'export.zip', { type: 'application/zip' });

      // Create a new workspace to import into
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Target Workspace' }
      });

      // Parse the import file
      const parseResult = (await orpc.workspaces.importParse({
        params: { workspace: targetWorkspace.url_slug },
        body: { file: exportFile }
      })) as any;

      expect(parseResult).toMatchObject({
        valid: true,
        version: expect.any(String),
        source_workspace: {
          id: expect.any(String),
          name: 'Default Workspace',
          url_slug: 'default'
        },
        available_data_types: expect.arrayContaining(['config', 'schemas', 'entities']),
        summary: expect.objectContaining({
          config: expect.any(Object),
          schemas: expect.any(Object),
          entities: expect.any(Object)
        }),
        conflicts: expect.any(Array),
        errors: expect.any(Array),
        warnings: expect.any(Array)
      });

      // Verify import_id is returned
      expect(parseResult).toHaveProperty('import_id');
      expect(typeof parseResult.import_id).toBe('string');
    });

    test('POST /api/:workspace/import/parse rejects invalid file format', async ({ orpc }) => {
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Invalid File Test' }
      });

      // Create an invalid file (not a ZIP)
      const invalidFile = new File(['not a zip file'], 'invalid.txt', { type: 'text/plain' });

      await expect(
        orpc.workspaces.importParse({
          params: { workspace: targetWorkspace.url_slug },
          body: { file: invalidFile }
        })
      ).rejects.toMatchObject({
        code: expect.stringMatching(/BAD_REQUEST|INTERNAL_SERVER_ERROR/)
      });
    });

    test('POST /api/:workspace/import/parse returns 404 for non-existent workspace', async ({
      orpc
    }) => {
      const dummyFile = new File(['dummy'], 'dummy.zip', { type: 'application/zip' });

      await expect(
        orpc.workspaces.importParse({
          params: { workspace: NONEXISTENT_UUID },
          body: { file: dummyFile }
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  test.describe('import execute', () => {
    test('POST /api/:workspace/import/execute imports data successfully', async ({
      orpc,
      server
    }) => {
      // Export from source workspace
      const exportResponse = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas'],
          options: { include_content: false }
        }
      });

      const exportBlob = exportResponse.body as Blob;
      const exportFile = new File([exportBlob], 'export.zip', { type: 'application/zip' });

      // Create target workspace
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Execute Test Workspace' }
      });

      // Parse the import
      const parseResult = await orpc.workspaces.importParse({
        params: { workspace: targetWorkspace.url_slug },
        body: { file: exportFile }
      });

      expect((parseResult as any).import_id).toBeDefined();

      // Execute the import
      const executeResult = await orpc.workspaces.importExecute({
        params: { workspace: targetWorkspace.url_slug },
        body: {
          import_id: (parseResult as any).import_id!,
          include: ['config', 'schemas'],
          conflict_resolutions: suggestedResolutions(parseResult),
          options: {
            preserve_ids: false,
            update_references: true
          }
        }
      });

      expect(executeResult).toMatchObject({
        success: true,
        imported: expect.objectContaining({
          config: expect.any(Object),
          schemas: expect.any(Object)
        }),
        errors: [],
        warnings: expect.any(Array)
      });

      // Verify data was imported
      const lifecycleStates = await server.db.workspace.listLifecycleStates(targetWorkspace.id);
      expect(lifecycleStates.length).toBeGreaterThan(0);
    });

    test('POST /api/:workspace/import/execute returns 404 for expired/invalid import_id', async ({
      orpc
    }) => {
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Expired Test' }
      });

      await expect(
        orpc.workspaces.importExecute({
          params: { workspace: targetWorkspace.url_slug },
          body: {
            import_id: NONEXISTENT_UUID,
            include: ['config'],
            conflict_resolutions: {},
            options: {}
          }
        })
      ).rejects.toMatchObject({
        code: expect.stringMatching(/NOT_FOUND|BAD_REQUEST/)
      });
    });

    test('POST /api/:workspace/import/execute returns 404 for non-existent workspace', async ({
      orpc
    }) => {
      await expect(
        orpc.workspaces.importExecute({
          params: { workspace: NONEXISTENT_UUID },
          body: {
            import_id: NONEXISTENT_UUID,
            include: ['config'],
            conflict_resolutions: {},
            options: {}
          }
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  test.describe('full export/import flow', () => {
    test('complete export and import cycle preserves data', async ({ orpc, server }) => {
      // Create source workspace with custom data
      const sourceWorkspace = await orpc.workspaces.create({
        body: {
          name: 'Source Workspace for Full Test',
          description: 'Test workspace with custom data'
        }
      });

      // Export the source workspace
      const exportResponse = await orpc.workspaces.export({
        params: { workspace: sourceWorkspace.url_slug },
        body: {
          include: ['config', 'schemas', 'entities', 'projects'],
          options: { include_content: false }
        }
      });

      const exportBlob = exportResponse.body as Blob;
      expect(exportBlob.size).toBeGreaterThan(0);

      // Create target workspace
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Target Workspace for Full Test' }
      });

      // Import into target workspace
      const exportFile = new File([exportBlob], 'export.zip', { type: 'application/zip' });

      const parseResult = await orpc.workspaces.importParse({
        params: { workspace: targetWorkspace.url_slug },
        body: { file: exportFile }
      });

      expect(parseResult.valid).toBe(true);
      expect((parseResult as any).import_id).toBeDefined();

      const executeResult = await orpc.workspaces.importExecute({
        params: { workspace: targetWorkspace.url_slug },
        body: {
          import_id: (parseResult as any).import_id!,
          include: ['config', 'schemas', 'entities', 'projects'],
          conflict_resolutions: suggestedResolutions(parseResult),
          options: {
            preserve_ids: false,
            update_references: true
          }
        }
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.errors).toHaveLength(0);

      // Verify imported data
      const targetLifecycleStates = await server.db.workspace.listLifecycleStates(
        targetWorkspace.id
      );
      const sourceLifecycleStates = await server.db.workspace.listLifecycleStates(
        sourceWorkspace.id
      );

      expect(targetLifecycleStates.length).toBe(sourceLifecycleStates.length);
      expect(targetLifecycleStates.map(s => s.label)).toEqual(
        sourceLifecycleStates.map(s => s.label)
      );
    });
  });
});
