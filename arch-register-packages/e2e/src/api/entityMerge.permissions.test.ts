import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

test.describe('entity merge preview permissions', () => {
  test('admins get a side-effect-free preview; non-admins are forbidden', async ({
    server,
    personas,
    resources
  }) => {
    const sourceId = resources.entityIds.frontendApp;
    const targetId = resources.entityIds.authService;

    const before = await server.db.catalog.getEntity(resources.workspaceId, sourceId);
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
    expect(Array.isArray(preview.dependentImpact)).toBe(true);
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
  });
});
