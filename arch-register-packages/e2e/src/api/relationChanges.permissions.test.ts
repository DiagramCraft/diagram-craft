import { randomUUID } from 'node:crypto';
import { upsertRelationApprovalPolicy } from '@arch-register/server/domain/governance/schemaGovernancePolicy';
import type { TestORPCClient } from '../helpers/orpcTestClient';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const DATA_FLOW_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';
const DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000003';

const test = createPermissionApiTest().extend<{ approvalRequired: true }>({
  approvalRequired: [
    async ({ server, resources }, use) => {
      const schema = await server.db.relation.getRelationSchema(
        resources.workspaceId,
        DATA_FLOW_SCHEMA_ID
      );
      if (!schema) throw new Error('Expected seeded Data Flow relation schema to exist');

      const schemaUpdatedAt = new Date();
      const updated = await server.db.relation.updateRelationSchema(
        resources.workspaceId,
        schema.id,
        {
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
          updated_at: schemaUpdatedAt
        }
      );
      if (!updated) throw new Error('Expected relation schema update to succeed');
      // Approval revisions resolve the schema as of their creation, i.e. from schema versions
      await server.db.relation.createRelationSchemaVersion({
        id: randomUUID(),
        workspace: resources.workspaceId,
        schema_id: updated.id,
        version: updated.version ?? 1,
        name: updated.name,
        description: updated.description,
        in_schema_ids: updated.in_schema_ids,
        out_schema_ids: updated.out_schema_ids,
        in_label: updated.in_label,
        out_label: updated.out_label,
        fields: updated.fields,
        groups: updated.groups ?? [],
        color: updated.color,
        icon: updated.icon,
        change_summary: {},
        created_by: null,
        created_at: schemaUpdatedAt
      });
      await use(true);
    },
    { scope: 'file' }
  ]
});

const setPolicy = (
  server: { db: Parameters<typeof upsertRelationApprovalPolicy>[0] },
  workspaceId: string,
  policy: 'required' | 'disabled'
) =>
  upsertRelationApprovalPolicy(
    server.db,
    workspaceId,
    DATA_FLOW_SCHEMA_ID,
    policy,
    new Date(),
    null
  );

type Persona = { orpc: TestORPCClient };

// Relations are created while approval is disabled (direct writes are blocked once required)
const createRelation = async (
  server: Parameters<typeof setPolicy>[0],
  workspaceId: string,
  creator: Persona,
  inEntityId: string,
  outEntityId: string,
  data: Record<string, unknown> = {}
): Promise<{ _uid: string }> => {
  await setPolicy(server, workspaceId, 'disabled');
  try {
    return await creator.orpc.relations.create({
      params: { workspace: 'default' },
      body: {
        _schemaId: DATA_FLOW_SCHEMA_ID,
        _inEntityId: inEntityId,
        _outEntityId: outEntityId,
        direction: 'one-way',
        data_classification: 'sensitive',
        ...data
      } as never
    });
  } finally {
    await setPolicy(server, workspaceId, 'required');
  }
};

const decideCase = async (
  decider: Persona,
  caseId: string,
  decision: 'approve' | 'request_changes',
  key: string
) => {
  const tasks = await decider.orpc.governance.assignments.mine({
    params: { workspace: 'default' },
    query: {}
  });
  const task = tasks.find(candidate => candidate.case.id === caseId);
  if (!task) throw new Error(`Expected an open assignment for case '${caseId}'`);
  return decider.orpc.governance.assignments.decide({
    params: { workspace: 'default', id: task.assignment.id },
    body: { decision, reason: 'e2e decision', idempotencyKey: key }
  });
};

test.describe('relation change approvals', () => {
  test('current approval is null until a proposal is submitted', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );

    const current = await personas.workspaceEditor.orpc.relationChanges.get({
      params: { workspace: 'default', id: created._uid }
    });
    expect(current).toBeNull();
  });

  test('submit, resubmit and withdraw follow the proposal lifecycle', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };

    const submitted = await personas.workspaceEditor.orpc.relationChanges.submit({
      params,
      body: {
        baseVersion: 1,
        proposedState: { data: { data_classification: 'internal', direction: 'one-way' } },
        message: 'Downgrade classification'
      }
    });
    expect(submitted).toMatchObject({ status: expect.any(String) });

    const current = await personas.workspaceEditor.orpc.relationChanges.get({ params });
    expect(current).not.toBeNull();
    expect(current!.id).toBe(submitted.id);

    // Direct writes stay blocked while a policy requires approval
    await expect(
      personas.workspaceEditor.orpc.relations.update({
        params,
        body: { data_classification: 'public' } as never
      })
    ).rejects.toMatchObject({ status: 409 });

    // Resubmitting is only possible once a reviewer has asked for changes
    await expect(
      personas.workspaceEditor.orpc.relationChanges.resubmit({
        params: { ...params, approvalId: submitted.id },
        body: { baseVersion: 1, proposedState: { data: {} } }
      })
    ).rejects.toMatchObject({ status: 409 });
    const caseId = (await personas.workspaceEditor.orpc.relationChanges.get({ params }))!
      .revisions[0]!.caseId!;
    await decideCase(personas.workspaceAdmin, caseId, 'request_changes', `rc-${created._uid}`);

    const resubmitted = await personas.workspaceEditor.orpc.relationChanges.resubmit({
      params: { ...params, approvalId: submitted.id },
      body: {
        baseVersion: 1,
        proposedState: { data: { data_classification: 'public', direction: 'one-way' } },
        message: 'Make public instead'
      }
    });
    expect(resubmitted.id).toBe(submitted.id);

    const withdrawn = await personas.workspaceEditor.orpc.relationChanges.withdraw({
      params: { ...params, approvalId: submitted.id },
      body: { reason: 'Changed my mind' }
    });
    expect(withdrawn.id).toBe(submitted.id);
    expect(await personas.workspaceEditor.orpc.relationChanges.get({ params })).toBeNull();

    const row = await server.db.relation.getRelation(resources.workspaceId, created._uid);
    expect(row?.data.data_classification).toBe('sensitive');
  });

  test('requires proposal and override capabilities', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };
    const body = {
      baseVersion: 1,
      proposedState: { data: { data_classification: 'internal', direction: 'one-way' } }
    };

    for (const persona of [personas.workspaceViewer, personas.outsider]) {
      await expect(persona.orpc.relationChanges.submit({ params, body })).rejects.toMatchObject({
        code: expect.stringMatching(/FORBIDDEN|NOT_FOUND|UNAUTHORIZED/)
      });
      await expect(
        persona.orpc.relationChanges.bypass({ params, body: { ...body, reason: 'No access' } })
      ).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|NOT_FOUND|UNAUTHORIZED/) });
    }

    const row = await server.db.relation.getRelation(resources.workspaceId, created._uid);
    expect(row?.version).toBe(1);
  });

  test('rejects submissions when approval is not required or the base version is stale', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };
    const body = {
      baseVersion: 1,
      proposedState: { data: { data_classification: 'internal', direction: 'one-way' } }
    };

    await expect(
      personas.workspaceEditor.orpc.relationChanges.submit({
        params,
        body: { ...body, baseVersion: 7 }
      })
    ).rejects.toMatchObject({ status: 409 });

    await setPolicy(server, resources.workspaceId, 'disabled');
    try {
      await expect(
        personas.workspaceEditor.orpc.relationChanges.submit({ params, body })
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await setPolicy(server, resources.workspaceId, 'required');
    }
  });

  test('rejects proposals that change immutable endpoints or schema', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };
    const data = { data_classification: 'internal', direction: 'one-way' };

    for (const changed of [
      { in_entity_id: resources.entityIds.identityPlatform },
      { out_entity_id: resources.entityIds.customerPortal },
      { schema_id: '00000000-0000-0000-0000-00000000dead' }
    ]) {
      await expect(
        personas.workspaceEditor.orpc.relationChanges.submit({
          params,
          body: { baseVersion: 1, proposedState: { data, ...changed } }
        })
      ).rejects.toMatchObject({ status: 400 });
    }

    expect(await personas.workspaceEditor.orpc.relationChanges.get({ params })).toBeNull();
  });

  test('restricted field groups cannot be proposed without access and are redacted on read', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform,
      { regulatory_tags: ['gdpr'] }
    );
    const params = { workspace: 'default', id: created._uid };

    await expect(
      personas.workspaceEditor.orpc.relationChanges.submit({
        params,
        body: {
          baseVersion: 1,
          proposedState: {
            data: {
              data_classification: 'sensitive',
              direction: 'one-way',
              regulatory_tags: ['pci-dss']
            }
          }
        }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await personas.securityTeamAdmin.orpc.relationChanges.submit({
      params,
      body: {
        baseVersion: 1,
        proposedState: {
          data: {
            data_classification: 'internal',
            direction: 'one-way',
            regulatory_tags: ['pci-dss']
          }
        }
      }
    });

    const adminView = await personas.securityTeamAdmin.orpc.relationChanges.get({ params });
    expect(JSON.stringify(adminView)).toContain('pci-dss');

    const editorView = await personas.workspaceEditor.orpc.relationChanges.get({ params });
    expect(editorView).not.toBeNull();
    expect(JSON.stringify(editorView)).toContain('internal');
    expect(JSON.stringify(editorView)).not.toContain('pci-dss');
    expect(JSON.stringify(editorView)).not.toContain('gdpr');
  });

  test('bypass applies the change immediately and records an audit trail', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };
    const proposedState = { data: { data_classification: 'internal', direction: 'one-way' } };

    await personas.workspaceEditor.orpc.relationChanges.submit({
      params,
      body: { baseVersion: 1, proposedState }
    });

    await expect(
      personas.workspaceAdmin.orpc.relationChanges.bypass({
        params,
        body: { baseVersion: 99, proposedState, reason: 'Stale' }
      })
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      personas.workspaceAdmin.orpc.relationChanges.bypass({
        params,
        body: { baseVersion: 1, proposedState, reason: '' }
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/BAD_REQUEST|INVALID/) });

    const result = await personas.workspaceAdmin.orpc.relationChanges.bypass({
      params,
      body: { baseVersion: 1, proposedState, reason: 'Urgent fix' }
    });
    expect(result).toMatchObject({ relationId: created._uid, version: 2, bypassed: true });

    const row = await server.db.relation.getRelation(resources.workspaceId, created._uid);
    expect(row?.version).toBe(2);
    expect(row?.data.data_classification).toBe('internal');
    expect(row?.in_entity_id).toBe(resources.entityIds.customerPortal);
    expect(row?.out_entity_id).toBe(resources.entityIds.identityPlatform);

    // The open proposal is closed by the bypass
    expect(await personas.workspaceEditor.orpc.relationChanges.get({ params })).toBeNull();

    const logs = await server.db.audit.listAuditLogs(resources.workspaceId);
    const bypassLog = logs.find(
      log => log.entity_id === created._uid && log.metadata.approvalBypass === true
    );
    expect(bypassLog).toMatchObject({
      operation: 'update',
      entity_type: 'relation',
      metadata: { approvalBypass: true, reason: 'Urgent fix' }
    });

    const versions = await server.db.catalog.listEntityVersions(
      resources.workspaceId,
      created._uid
    );
    expect(versions.find(version => version.version_number === 2)).toBeDefined();
  });

  test('an approved proposal is applied with case audit metadata and a case_applied version', async ({
    server,
    personas,
    resources,
    approvalRequired: _
  }) => {
    const created = await createRelation(
      server,
      resources.workspaceId,
      personas.securityTeamAdmin,
      resources.entityIds.customerPortal,
      resources.entityIds.identityPlatform
    );
    const params = { workspace: 'default', id: created._uid };

    const submitted = await personas.workspaceEditor.orpc.relationChanges.submit({
      params,
      body: {
        baseVersion: 1,
        proposedState: { data: { data_classification: 'internal', direction: 'one-way' } },
        message: 'Needs approval'
      }
    });

    expect(submitted.status).toBe('open');
    const caseId = (await personas.workspaceEditor.orpc.relationChanges.get({ params }))!
      .revisions[0]!.caseId!;
    await decideCase(personas.workspaceAdmin, caseId, 'approve', `approve-${created._uid}`);

    const row = await server.db.relation.getRelation(resources.workspaceId, created._uid);
    expect(row?.version).toBe(2);
    expect(row?.data.data_classification).toBe('internal');

    const versions = await server.db.catalog.listEntityVersions(
      resources.workspaceId,
      created._uid
    );
    const applied = versions.find(version => version.kind === 'case_applied');
    expect(applied).toBeDefined();
    expect(applied?.applied_case_revision_id).not.toBeNull();

    const logs = await server.db.audit.listAuditLogs(resources.workspaceId);
    const appliedLog = logs.find(
      log => log.entity_id === created._uid && log.metadata.governanceCaseId != null
    );
    expect(appliedLog).toMatchObject({
      operation: 'update',
      entity_type: 'relation',
      metadata: {
        revisionId: applied?.applied_case_revision_id
      }
    });
  });
});
