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
        updated_at: new Date(),
        completeness: entity.completeness
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
    await db.entityChange.createApproval({
      id: proposalId,
      workspace,
      entity_id: entity.id,
      status: 'open',
      initiator_user_id: null,
      created_at: now,
      updated_at: now,
      closed_at: null
    });
    const revision = await db.entityChange.createApprovalRevision({
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
    expect((await db.entityChange.getLatestApprovalRevision(workspace, proposalId))!.id).toBe(
      revision.id
    );
    expect(await db.entityChange.listApprovalRevisions(workspace, proposalId)).toHaveLength(1);
  });

  it('stores a bulk revision spanning multiple entities', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schemaId = await createFixtureSchema(db, workspace);
    const entityA = await createFixtureCatalogEntity(db, workspace, schemaId);
    const entityB = await createFixtureCatalogEntity(db, workspace, schemaId);

    const bulkProposalId = randomUUID();
    const now = new Date();
    await db.entityChange.createApproval({
      id: bulkProposalId,
      workspace,
      entity_id: entityA.id,
      status: 'open',
      initiator_user_id: null,
      created_at: now,
      updated_at: now,
      closed_at: null
    });
    const revisionId = randomUUID();
    const members = await db.entityChange.createBulkApprovalRevision({
      id: revisionId,
      proposal_id: bulkProposalId,
      workspace,
      revision_number: 1,
      policy_version: `${schemaId}:1:inherit`,
      resolved_policy: { selfApprovalAllowed: false },
      message: null,
      created_by: null,
      status: 'submitted',
      created_at: now,
      resolved_at: null,
      members: [
        {
          entity_id: entityA.id,
          base_version: 1,
          base_state: { name: entityA.name },
          proposed_state: { name: 'Updated A' },
          diff: { name: { before: entityA.name, after: 'Updated A' } }
        },
        {
          entity_id: entityB.id,
          base_version: 1,
          base_state: { name: entityB.name },
          proposed_state: { name: 'Updated B' },
          diff: { name: { before: entityB.name, after: 'Updated B' } }
        }
      ]
    });

    expect(members).toHaveLength(2);
    expect(new Set(members.map(member => member.entity_id))).toEqual(
      new Set([entityA.id, entityB.id])
    );
    expect(new Set(members.map(member => member.member_id)).size).toBe(2);
    members.forEach(member => expect(member.id).toBe(revisionId));

    const fetchedMembers = await db.entityChange.getApprovalRevisionMembers(workspace, revisionId);
    expect(fetchedMembers).toHaveLength(2);
    expect((await db.entityChange.getApprovalRevision(workspace, revisionId))!.id).toBe(revisionId);
  });
});
