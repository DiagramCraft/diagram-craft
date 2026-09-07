import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { flattenEntityAuditFields } from '@arch-register/server/domain/audit/db/auditLogging';

const test = createPermissionApiTest();

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
