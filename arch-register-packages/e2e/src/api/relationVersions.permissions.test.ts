import { randomUUID } from 'node:crypto';
import { relationToBaseState } from '@arch-register/server/domain/catalog/relationHelpers';
import { upsertRelationApprovalPolicy } from '@arch-register/server/domain/governance/schemaGovernancePolicy';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { NONEXISTENT_UUID } from '../helpers/testIds';

const DATA_FLOW_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';
const DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000003';

const test = createPermissionApiTest().extend<{ restrictedDataFlow: true }>({
  restrictedDataFlow: [
    async ({ server, resources }, use) => {
      const schema = await server.db.relation.getRelationSchema(
        resources.workspaceId,
        DATA_FLOW_SCHEMA_ID
      );
      if (!schema) throw new Error('Expected seeded Data Flow relation schema to exist');

      await server.db.relation.updateRelationSchema(resources.workspaceId, schema.id, {
        name: schema.name,
        category_id: schema.category_id,
        description: schema.description,
        in_schema_ids: schema.in_schema_ids,
        out_schema_ids: schema.out_schema_ids,
        in_label: schema.in_label,
        out_label: schema.out_label,
        fields: schema.fields,
        groups: (schema.groups ?? []).map(group =>
          group.id === DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID
            ? { ...group, accessControl: { teamIds: [resources.teamIds.security] } }
            : group
        ),
        shared_field_group_links: schema.shared_field_group_links ?? [],
        color: schema.color,
        icon: schema.icon,
        version: (schema.version ?? 1) + 1,
        updated_at: new Date()
      });
      // Restores and direct edits must not be blocked by an approval requirement.
      await upsertRelationApprovalPolicy(
        server.db,
        resources.workspaceId,
        DATA_FLOW_SCHEMA_ID,
        'disabled',
        new Date(),
        null
      );

      await use(true);
    },
    { scope: 'file' }
  ]
});

const createRelation = async (
  creator: { orpc: { relations: { create: (input: never) => Promise<{ _uid: string }> } } },
  inEntityId: string,
  outEntityId: string,
  data: Record<string, unknown> = {}
) =>
  creator.orpc.relations.create({
    params: { workspace: 'default' },
    body: {
      _schemaId: DATA_FLOW_SCHEMA_ID,
      _inEntityId: inEntityId,
      _outEntityId: outEntityId,
      direction: 'one-way',
      data_classification: 'sensitive',
      ...data
    }
  } as never);

test.describe('relation versions', () => {
  test('list and get redact restricted field groups for users without access', async ({
    personas,
    resources,
    restrictedDataFlow: _
  }) => {
    const created = await createRelation(
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform,
      { regulatory_tags: ['gdpr'], source_residency_region: 'eu' }
    );

    const params = { workspace: 'default', id: created._uid };

    const editorVersions = await personas.workspaceEditor.orpc.relationVersions.list({ params });
    expect(editorVersions.length).toBeGreaterThan(0);
    for (const version of editorVersions) {
      expect(version.record_id).toBe(created._uid);
      expect(version.state.data).toMatchObject({ data_classification: 'sensitive' });
      expect(version.state.data).not.toHaveProperty('regulatory_tags');
      expect(version.state.data).not.toHaveProperty('source_residency_region');
    }

    const editorVersion = await personas.workspaceEditor.orpc.relationVersions.get({
      params: { ...params, versionId: editorVersions[0]!.id }
    });
    expect(editorVersion.state.data).not.toHaveProperty('regulatory_tags');

    const adminVersion = await personas.securityTeamAdmin.orpc.relationVersions.get({
      params: { ...params, versionId: editorVersions[0]!.id }
    });
    expect(adminVersion.state.data).toMatchObject({
      regulatory_tags: ['gdpr'],
      source_residency_region: 'eu'
    });
  });

  test('fails closed when the historical schema for a version is unavailable', async ({
    server,
    personas,
    resources,
    restrictedDataFlow: _
  }) => {
    const created = await createRelation(
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform,
      { regulatory_tags: ['gdpr'] }
    );
    const params = { workspace: 'default', id: created._uid };
    const [version] = await personas.securityTeamAdmin.orpc.relationVersions.list({ params });

    const original = server.db.relation.listRelationSchemaVersions.bind(server.db.relation);
    server.db.relation.listRelationSchemaVersions = async (workspace, schemaId) =>
      schemaId === DATA_FLOW_SCHEMA_ID ? [] : original(workspace, schemaId);

    try {
      const fetched = await personas.workspaceEditor.orpc.relationVersions.get({
        params: { ...params, versionId: version!.id }
      });
      expect(JSON.stringify(fetched.state)).not.toContain('gdpr');
      const listed = await personas.workspaceEditor.orpc.relationVersions.list({ params });
      expect(JSON.stringify(listed)).not.toContain('gdpr');
    } finally {
      server.db.relation.listRelationSchemaVersions = original;
    }
  });

  test('returns 404/NOT_FOUND/BAD_REQUEST for unknown relations, versions and mismatched versions', async ({
    personas,
    resources,
    restrictedDataFlow: _
  }) => {
    const first = await createRelation(
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const second = await createRelation(
      personas.securityTeamAdmin,
      resources.entityIds.identityPlatform,
      resources.entityIds.customerPortal
    );
    const secondVersions = await personas.workspaceEditor.orpc.relationVersions.list({
      params: { workspace: 'default', id: second._uid }
    });

    await expect(
      personas.workspaceEditor.orpc.relationVersions.list({
        params: { workspace: 'default', id: NONEXISTENT_UUID }
      })
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      personas.workspaceEditor.orpc.relationVersions.get({
        params: { workspace: 'default', id: first._uid, versionId: NONEXISTENT_UUID }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      personas.workspaceEditor.orpc.relationVersions.get({
        params: { workspace: 'default', id: first._uid, versionId: secondVersions[0]!.id }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('restore requires edit access', async ({ personas, resources, restrictedDataFlow: _ }) => {
    const created = await createRelation(
      personas.workspaceEditor,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };

    const [initial] = await personas.workspaceEditor.orpc.relationVersions.list({ params });

    await expect(
      personas.workspaceViewer.orpc.relationVersions.restore({
        params: { ...params, versionId: initial!.id },
        body: {}
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // The relation restore wraps ORPCErrors (BAD_REQUEST here) in runAuthorizedOperation, which only
  // preserves HTTPErrors, so a non-restorable version currently surfaces as INTERNAL_SERVER_ERROR.
  test.fails('restore rejects versions that are not autosave, saved_version or case_applied', async ({
    server,
    personas,
    resources,
    restrictedDataFlow: _
  }) => {
    const created = await createRelation(
      personas.workspaceEditor,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const row = await server.db.relation.getRelation(resources.workspaceId, created._uid);
    if (!row) throw new Error('Expected relation to exist');

    const directEditVersionId = randomUUID();
    await server.db.catalog.createEntityVersion({
      id: directEditVersionId,
      workspace: resources.workspaceId,
      record_id: row.id,
      version_number: row.version + 1000,
      kind: 'direct_edit',
      commit_message: null,
      created_at: new Date(),
      created_by: null,
      state: relationToBaseState(row),
      applied_case_revision_id: null
    });
    await expect(
      personas.workspaceEditor.orpc.relationVersions.restore({
        params: { workspace: 'default', id: created._uid, versionId: directEditVersionId },
        body: {}
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('restore rejects a restricted-field change without edit access and writes no audit record', async ({
    server,
    personas,
    resources,
    restrictedDataFlow: _
  }) => {
    const created = await createRelation(
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform,
      { regulatory_tags: ['gdpr'] }
    );
    const params = { workspace: 'default', id: created._uid };
    const [initial] = await personas.securityTeamAdmin.orpc.relationVersions.list({ params });

    await personas.securityTeamAdmin.orpc.relations.update({
      params,
      body: { regulatory_tags: ['pci-dss'] } as never
    });
    const before = await server.db.audit.listAuditLogs(resources.workspaceId);

    await expect(
      personas.workspaceEditor.orpc.relationVersions.restore({
        params: { ...params, versionId: initial!.id },
        body: { commitMessage: 'Should be rejected' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const after = await server.db.audit.listAuditLogs(resources.workspaceId);
    const row = await server.db.relation.getRelation(resources.workspaceId, created._uid);
    expect(row?.data.regulatory_tags).toEqual(['pci-dss']);
    expect(after).toHaveLength(before.length);
  });

  test('restore keeps endpoints immutable and records version and audit metadata', async ({
    server,
    personas,
    resources,
    restrictedDataFlow: _
  }) => {
    const created = await createRelation(
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform,
      { regulatory_tags: ['gdpr'] }
    );
    const params = { workspace: 'default', id: created._uid };
    const [initial] = await personas.securityTeamAdmin.orpc.relationVersions.list({ params });
    await personas.securityTeamAdmin.orpc.relations.update({
      params,
      body: { regulatory_tags: ['pci-dss'] } as never
    });

    const restored = await personas.securityTeamAdmin.orpc.relationVersions.restore({
      params: { ...params, versionId: initial!.id },
      body: { commitMessage: 'Back to the start' }
    });

    // The response is the version that was restored from; the restore itself is a new version.
    expect(restored.id).toBe(initial!.id);
    expect(restored.state.data).toMatchObject({ regulatory_tags: ['gdpr'] });
    expect(restored.state).toMatchObject({
      in_entity_id: resources.entityIds.customerPortal,
      out_entity_id: resources.entityIds.identityPlatform
    });

    const row = await server.db.relation.getRelation(resources.workspaceId, created._uid);
    expect(row?.in_entity_id).toBe(resources.entityIds.customerPortal);
    expect(row?.out_entity_id).toBe(resources.entityIds.identityPlatform);
    expect(row?.data.regulatory_tags).toEqual(['gdpr']);

    const logs = await server.db.audit.listAuditLogs(resources.workspaceId);
    const restoreLog = logs.find(
      log => log.entity_id === created._uid && log.metadata.restore_from_version_id === initial!.id
    );
    expect(restoreLog).toMatchObject({
      operation: 'update',
      entity_type: 'relation',
      metadata: { restore_commit_message: 'Back to the start' }
    });

    const versions = await server.db.catalog.listEntityVersions(
      resources.workspaceId,
      created._uid
    );
    const restoredVersion = versions.find(version => version.kind === 'restored');
    expect(restoredVersion).toMatchObject({ commit_message: 'Back to the start' });
    expect(restoredVersion?.state).toMatchObject({ data: { regulatory_tags: ['gdpr'] } });
  });

  test('hides versions when an endpoint schema is not visible to the caller', async ({
    server,
    personas,
    resources,
    restrictedDataFlow: _
  }) => {
    const created = await createRelation(
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };
    const [version] = await personas.workspaceEditor.orpc.relationVersions.list({ params });
    expect(version).toBeDefined();

    const inEntity = await server.db.catalog.getEntity(
      resources.workspaceId,
      resources.entityIds.customerPortal
    );
    const missingSchemaId = inEntity!.schema_id;
    const originalListSchemas = server.db.catalog.listSchemas.bind(server.db.catalog);
    const originalGetSchema = server.db.catalog.getSchema.bind(server.db.catalog);
    const originalListSchemaVersions = server.db.catalog.listSchemaVersions.bind(server.db.catalog);
    server.db.catalog.listSchemas = async workspace =>
      (await originalListSchemas(workspace)).filter(schema => schema.id !== missingSchemaId);
    server.db.catalog.getSchema = async (workspace, schemaId) =>
      schemaId === missingSchemaId ? null : originalGetSchema(workspace, schemaId);
    server.db.catalog.listSchemaVersions = async (workspace, schemaId) =>
      schemaId === missingSchemaId ? [] : originalListSchemaVersions(workspace, schemaId);

    try {
      expect(await personas.workspaceEditor.orpc.relationVersions.list({ params })).toEqual([]);
      await expect(
        personas.workspaceEditor.orpc.relationVersions.get({
          params: { ...params, versionId: version!.id }
        })
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      server.db.catalog.listSchemas = originalListSchemas;
      server.db.catalog.getSchema = originalGetSchema;
      server.db.catalog.listSchemaVersions = originalListSchemaVersions;
    }
  });
});
