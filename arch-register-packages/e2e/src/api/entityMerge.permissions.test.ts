import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { flattenEntityAuditFields } from '@arch-register/server/domain/audit/db/auditLogging';
import { seededEntities } from '@arch-register/server/db/seedFixtures';

const test = createPermissionApiTest();

const buildExecuteBody = (preview: {
  sourceVersion: number;
  targetVersion: number;
  previewFingerprint: string;
  fieldConflicts: { fieldKey: string }[];
  relationConflicts: { relationId: string; note: 'duplicate' | 'self' }[];
  sideTableConflicts: { conflictId: string }[];
}) => ({
  expectedSourceVersion: preview.sourceVersion,
  expectedTargetVersion: preview.targetVersion,
  previewFingerprint: preview.previewFingerprint,
  fieldResolutions: Object.fromEntries(
    preview.fieldConflicts.map(conflict => [conflict.fieldKey, 'target'])
  ) as Record<string, 'source' | 'target'>,
  relationResolutions: Object.fromEntries(
    preview.relationConflicts.map(conflict => [
      conflict.relationId,
      conflict.note === 'self' ? 'drop_source' : 'keep_target'
    ])
  ) as Record<string, 'keep_source' | 'keep_target' | 'drop_source'>,
  sideTableResolutions: Object.fromEntries(
    preview.sideTableConflicts.map(conflict => [conflict.conflictId, 'keep_target'])
  ) as Record<string, 'keep_source' | 'keep_target' | 'drop_source'>
});

test.describe('entity merge preview permissions', () => {
  test('admins get a side-effect-free preview; non-admins are forbidden', async ({
    server,
    personas,
    resources
  }) => {
    const sourceId = resources.entityIds.frontendApp;
    const targetId = resources.entityIds.authService;
    const dependentId = resources.entityIds.apiGateway;

    const dependentSeed = await server.db.catalog.getEntity(resources.workspaceId, dependentId);
    if (!dependentSeed) throw new Error('Expected API Gateway entity to exist');
    const dependsOn = Array.isArray(dependentSeed.data.depends_on)
      ? dependentSeed.data.depends_on.filter((id): id is string => typeof id === 'string')
      : [];
    const seededDependent = await server.db.catalog.updateEntity(
      resources.workspaceId,
      dependentId,
      {
        slug: dependentSeed.slug,
        namespace: dependentSeed.namespace,
        name: dependentSeed.name,
        description: dependentSeed.description,
        owner: dependentSeed.owner,
        lifecycle: dependentSeed.lifecycle,
        target_lifecycle: dependentSeed.target_lifecycle,
        target_lifecycle_date: dependentSeed.target_lifecycle_date,
        tags: dependentSeed.tags,
        links: dependentSeed.links,
        schema_id: dependentSeed.schema_id,
        data: { ...dependentSeed.data, depends_on: [...new Set([...dependsOn, sourceId])] },
        project_id: dependentSeed.project_id,
        updated_at: new Date(),
        completeness: dependentSeed.completeness
      }
    );
    if (!seededDependent) throw new Error('Expected API Gateway fixture update to succeed');
    const dependentBeforeMerge = await server.db.catalog.getEntity(
      resources.workspaceId,
      dependentId
    );
    if (!dependentBeforeMerge) throw new Error('Expected API Gateway entity after fixture update');

    const before = await server.db.catalog.getEntity(resources.workspaceId, sourceId);
    if (!before) throw new Error('Expected source entity to exist');
    const versionsBefore = await server.db.catalog.listEntityVersions(
      resources.workspaceId,
      sourceId
    );

    const preview = await personas.globalAdmin.orpc.entityMerges.preview({
      params: { workspace: 'default', id: sourceId },
      body: { targetId }
    });

    expect(preview.sourceId).toBe(sourceId);
    expect(preview.targetId).toBe(targetId);
    // Same-schema seeded components — no blockers expected.
    expect(preview.blockers).toEqual([]);
    expect(Array.isArray(preview.fieldConflicts)).toBe(true);
    expect(preview.dependentImpact).toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: dependentId })])
    );
    expect(Array.isArray(preview.relationConflicts)).toBe(true);

    // The preview must not mutate anything.
    const after = await server.db.catalog.getEntity(resources.workspaceId, sourceId);
    const versionsAfter = await server.db.catalog.listEntityVersions(
      resources.workspaceId,
      sourceId
    );
    expect(after?.version).toBe(before?.version);
    expect(after?.updated_at).toEqual(before?.updated_at);
    expect(versionsAfter.length).toBe(versionsBefore.length);

    // Cross-schema pair is flagged, not merged.
    const crossSchema = await personas.globalAdmin.orpc.entityMerges.preview({
      params: { workspace: 'default', id: sourceId },
      body: { targetId: resources.entityIds.customerApi }
    });
    expect(crossSchema.blockers.map(b => b.code)).toContain('different_schema');

    await expect(
      personas.workspaceEditor.orpc.entityMerges.preview({
        params: { workspace: 'default', id: sourceId },
        body: { targetId }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const targetBeforeMerge = await server.db.catalog.getEntity(resources.workspaceId, targetId);
    const executeBody = {
      targetId,
      expectedSourceVersion: preview.sourceVersion,
      expectedTargetVersion: preview.targetVersion,
      previewFingerprint: preview.previewFingerprint,
      fieldResolutions: Object.fromEntries(
        preview.fieldConflicts.map(conflict => [conflict.fieldKey, 'target'])
      ) as Record<string, 'source' | 'target'>,
      relationResolutions: Object.fromEntries(
        preview.relationConflicts.map(conflict => [
          conflict.relationId,
          conflict.note === 'self' ? 'drop_source' : 'keep_target'
        ])
      ) as Record<string, 'keep_source' | 'keep_target' | 'drop_source'>,
      sideTableResolutions: Object.fromEntries(
        preview.sideTableConflicts.map(conflict => [conflict.conflictId, 'keep_target'])
      ) as Record<string, 'keep_source' | 'keep_target' | 'drop_source'>
    };

    await expect(
      personas.globalAdmin.orpc.entityMerges.execute({
        params: { workspace: 'default', id: sourceId },
        body: { ...executeBody, previewFingerprint: `stale-${preview.previewFingerprint}` }
      })
    ).rejects.toMatchObject({ status: 409 });

    const executed = await personas.globalAdmin.orpc.entityMerges.execute({
      params: { workspace: 'default', id: sourceId },
      body: executeBody
    });
    expect(executed.sourceId).toBe(sourceId);
    expect(executed.targetId).toBe(targetId);
    expect(executed.entity._uid).toBe(targetId);

    const targetAfterMerge = await server.db.catalog.getEntity(resources.workspaceId, targetId);
    expect(targetAfterMerge?.version).toBe((targetBeforeMerge?.version ?? 1) + 1);
    const retiredLookup = await server.db.catalog.getEntity(resources.workspaceId, sourceId);
    expect(retiredLookup?.id).toBe(targetId);
    expect(retiredLookup?.redirect?.from).toBe(sourceId);
    expect(
      await server.db.catalog.resolveCatalogRecordMerge(resources.workspaceId, {
        kind: 'id',
        value: sourceId
      })
    ).toMatchObject({ canonical_record_id: targetId, merged_record_id: sourceId });
    expect(await server.db.catalog.listEntityVersions(resources.workspaceId, sourceId)).toEqual([]);

    const mergeAuditRows = (await server.db.audit.listAuditLogs(resources.workspaceId)).filter(
      row => row.metadata['mergeId'] === executed.mergeId
    );
    const mergeMetadata = {
      mergeId: executed.mergeId,
      sourceId,
      targetId
    };
    expect(mergeAuditRows).toHaveLength(3);
    expect(mergeAuditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'delete',
          entity_type: 'entity',
          entity_id: sourceId,
          metadata: mergeMetadata
        }),
        expect.objectContaining({
          operation: 'update',
          entity_type: 'entity',
          entity_id: targetId,
          metadata: mergeMetadata
        }),
        expect.objectContaining({
          operation: 'update',
          entity_type: 'entity',
          entity_id: dependentId,
          metadata: expect.objectContaining({ ...mergeMetadata, mergeDependent: true })
        })
      ])
    );

    const sourceAudit = mergeAuditRows.find(row => row.entity_id === sourceId);
    expect(sourceAudit?.changes).toEqual({ old: flattenEntityAuditFields(before) });

    const dependentAudit = mergeAuditRows.find(row => row.entity_id === dependentId);
    expect(dependentAudit?.changes.old?.['depends_on']).toEqual(expect.arrayContaining([sourceId]));
    expect(dependentAudit?.changes.new?.['depends_on']).toEqual(expect.arrayContaining([targetId]));
    expect(dependentAudit?.changes.new?.['depends_on']).not.toContain(sourceId);

    const sourceAuditEntries = await personas.globalAdmin.orpc.audit.list({
      params: { workspace: 'default' },
      query: { entityId: sourceId }
    });
    expect(sourceAuditEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_id: sourceId,
          operation: 'delete',
          metadata: expect.objectContaining(mergeMetadata)
        })
      ])
    );
  });
});

test.describe('entity merge external identity + project scope', () => {
  test('transfers the source external identities to the target and clears the post-check', async ({
    server,
    personas,
    resources
  }) => {
    const sourceId = seededEntities.default.customerApi.id;
    const targetId = seededEntities.default.authApi.id;
    const ws = resources.workspaceId;

    // (workspace, source, external_key) is the table's primary key, so a source and target
    // genuinely sharing a key cannot coexist — every source identity simply moves over.
    await server.db.externalIdentity.create({
      workspace: ws,
      source: 'jira',
      external_key: 'KEY-1',
      record_id: sourceId
    });
    await server.db.externalIdentity.create({
      workspace: ws,
      source: 'git',
      external_key: 'G-2',
      record_id: sourceId
    });
    await server.db.externalIdentity.create({
      workspace: ws,
      source: 'servicenow',
      external_key: 'SN-9',
      record_id: targetId
    });

    const preview = await personas.globalAdmin.orpc.entityMerges.preview({
      params: { workspace: 'default', id: sourceId },
      body: { targetId }
    });
    expect(preview.blockers).toEqual([]);
    expect(preview.sideTableCounts.externalIdentitiesTransferring).toBe(2);
    expect(preview.sideTableCounts.externalIdentitiesColliding).toBe(0);

    const executed = await personas.globalAdmin.orpc.entityMerges.execute({
      params: { workspace: 'default', id: sourceId },
      body: { targetId, ...buildExecuteBody(preview) }
    });

    expect(await server.db.externalIdentity.find(ws, 'jira', 'KEY-1')).toMatchObject({
      record_id: targetId
    });
    expect(await server.db.externalIdentity.find(ws, 'git', 'G-2')).toMatchObject({
      record_id: targetId
    });
    expect(await server.db.externalIdentity.find(ws, 'servicenow', 'SN-9')).toMatchObject({
      record_id: targetId
    });

    const retiredLookup = await server.db.catalog.getEntity(ws, sourceId);
    expect(retiredLookup?.id).toBe(targetId);

    const sourceDelete = (await server.db.audit.listAuditLogs(ws)).find(
      row => row.metadata['mergeId'] === executed.mergeId && row.entity_id === sourceId
    );
    expect(sourceDelete?.metadata['droppedExternalIdentities']).toBeUndefined();
  });

  test('project-confined source needs an explicit acknowledgement', async ({
    server,
    personas,
    resources
  }) => {
    const sourceId = seededEntities.default.acmeContract.id;
    const targetId = seededEntities.default.acmeSupportContract.id;
    const ws = resources.workspaceId;

    const source = await server.db.catalog.getEntity(ws, sourceId);
    if (!source) throw new Error('Expected acmeContract fixture');
    await server.db.catalog.updateEntity(ws, sourceId, {
      slug: source.slug,
      namespace: source.namespace,
      name: source.name,
      description: source.description,
      owner: source.owner,
      lifecycle: source.lifecycle,
      target_lifecycle: source.target_lifecycle,
      target_lifecycle_date: source.target_lifecycle_date,
      tags: source.tags,
      links: source.links,
      schema_id: source.schema_id,
      data: source.data,
      project_id: resources.projectIds.portalRedesign,
      updated_at: new Date(),
      completeness: source.completeness
    });

    const preview = await personas.globalAdmin.orpc.entityMerges.preview({
      params: { workspace: 'default', id: sourceId },
      body: { targetId }
    });
    expect(preview.blockers).toEqual([
      expect.objectContaining({ code: 'source_project_scope_dropped', acknowledgeable: true })
    ]);

    await expect(
      personas.globalAdmin.orpc.entityMerges.execute({
        params: { workspace: 'default', id: sourceId },
        body: { targetId, ...buildExecuteBody(preview) }
      })
    ).rejects.toMatchObject({ status: 409 });

    const executed = await personas.globalAdmin.orpc.entityMerges.execute({
      params: { workspace: 'default', id: sourceId },
      body: {
        targetId,
        ...buildExecuteBody(preview),
        acknowledgedBlockers: ['source_project_scope_dropped']
      }
    });
    expect(executed.targetId).toBe(targetId);

    const targetAfter = await server.db.catalog.getEntity(ws, targetId);
    expect(targetAfter?.project_id ?? null).toBeNull();

    const sourceDelete = (await server.db.audit.listAuditLogs(ws)).find(
      row => row.metadata['mergeId'] === executed.mergeId && row.entity_id === sourceId
    );
    expect(sourceDelete?.metadata['acknowledgedBlockers']).toEqual([
      'source_project_scope_dropped'
    ]);
  });
});
