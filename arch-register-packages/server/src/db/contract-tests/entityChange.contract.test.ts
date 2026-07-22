import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureCatalogEntity } from './catalogFixtures';
import { createFixtureSchema, createFixtureWorkspace } from './projectFixtures';

runContractSuiteAgainstBothDrivers('Entity change approval database', getDb => {
  it('stores immutable revisions and advances entity versions conditionally', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schemaId = await createFixtureSchema(db, workspace);
    const schema = (await db.catalog.getSchema(workspace, schemaId))!;
    const governedSchema = await db.catalog.updateSchema(workspace, schemaId, {
      name: schema.name,
      description: schema.description,
      fields: schema.fields,
      templates: schema.templates ?? [],
      color: schema.color,
      icon: schema.icon,
      default_owner: schema.default_owner,
      key_prefix: schema.key_prefix,
      entity_approval_policy: 'required',
      updated_at: new Date()
    });
    expect(governedSchema!.entity_approval_policy).toBe('required');

    const entity = await createFixtureCatalogEntity(db, workspace, schemaId);
    expect(entity.version).toBe(1);
    const updated = await db.catalog.updateEntityIfVersion(
      workspace,
      entity.id,
      {
        slug: entity.slug,
        namespace: entity.namespace,
        name: 'Updated entity',
        description: entity.description,
        owner: entity.owner,
        lifecycle: entity.lifecycle,
        target_lifecycle: entity.target_lifecycle,
        target_lifecycle_date: entity.target_lifecycle_date,
        tags: entity.tags,
        links: entity.links,
        schema_id: entity.schema_id,
        data: entity.data,
        project_id: entity.project_id,
        updated_at: new Date()
      },
      1
    );
    expect(updated!.version).toBe(2);
    expect(
      await db.catalog.updateEntityIfVersion(
        workspace,
        entity.id,
        { ...updated!, updated_at: new Date() },
        1
      )
    ).toBeNull();
    expect(
      (await db.catalog.setEntityApprovalPolicyOverride(workspace, entity.id, 'required'))!
        .approval_policy_override
    ).toBe('required');
    expect(
      (await db.catalog.setEntityApprovalPolicyOverride(workspace, entity.id, null))!
        .approval_policy_override
    ).toBeNull();

    const proposalId = randomUUID();
    const now = new Date();
    await db.entityChange.createProposal({
      id: proposalId,
      workspace,
      entity_id: entity.id,
      status: 'open',
      initiator_user_id: null,
      created_at: now,
      updated_at: now,
      closed_at: null
    });
    const revision = await db.entityChange.createRevision({
      id: randomUUID(),
      proposal_id: proposalId,
      workspace,
      entity_id: entity.id,
      revision_number: 1,
      base_version: 2,
      base_state: { name: entity.name },
      proposed_state: { name: 'Updated entity' },
      diff: { name: { before: entity.name, after: 'Updated entity' } },
      policy_version: `${schemaId}:1:inherit`,
      resolved_policy: { required: true },
      message: null,
      created_by: null,
      status: 'submitted',
      created_at: now,
      resolved_at: null
    });
    expect((await db.entityChange.getLatestRevision(workspace, proposalId))!.id).toBe(revision.id);
    expect(await db.entityChange.listRevisions(workspace, proposalId)).toHaveLength(1);
  });
});
