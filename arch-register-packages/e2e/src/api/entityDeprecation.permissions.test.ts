import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { encodeCaseSubkind } from '@arch-register/server/domain/governance/governanceCaseSubkind';
import { ENTITY_DEPRECATION_POLICY_CASE_KIND } from '@arch-register/server/domain/governance/schemaGovernancePolicy';

const COMPONENT_SCHEMA_ID = '00000000-0000-0000-0000-000000000003';
const RESTRICTED_RELATION_GROUP_ID = 'deprecation-restricted-relations';

const test = createPermissionApiTest().extend<{ deprecationSeed: true }>({
  deprecationSeed: [
    async ({ server, resources }, use) => {
      const schema = await server.db.catalog.getSchema(resources.workspaceId, COMPONENT_SCHEMA_ID);
      if (!schema) throw new Error('Expected seeded component schema to exist');

      const restrictedGroup = {
        id: RESTRICTED_RELATION_GROUP_ID,
        name: 'Restricted relationships',
        accessControl: { teamIds: [resources.teamIds.security] }
      };
      const updatedSchema = await server.db.catalog.updateSchema(resources.workspaceId, schema.id, {
        name: schema.name,
        description: schema.description,
        fields: schema.fields.map(field =>
          field.id === 'depends_on' ? { ...field, groupId: RESTRICTED_RELATION_GROUP_ID } : field
        ),
        templates: schema.templates,
        groups: [...(schema.groups ?? []), restrictedGroup],
        shared_field_group_links: schema.shared_field_group_links,
        color: schema.color,
        icon: schema.icon,
        default_owner: schema.default_owner,
        key_prefix: schema.key_prefix,
        entity_approval_policy: schema.entity_approval_policy,
        deprecation_policy: 'required',
        version: (schema.version ?? 1) + 1,
        updated_at: new Date('2026-08-05T00:00:00.000Z')
      });
      if (!updatedSchema) throw new Error('Expected component schema update to succeed');
      await server.db.governanceCaseConfig.upsertCaseConfig({
        workspace: resources.workspaceId,
        case_kind: ENTITY_DEPRECATION_POLICY_CASE_KIND,
        case_subkind: encodeCaseSubkind(schema.id),
        enabled: true,
        config: {},
        updated_at: new Date('2026-08-05T00:00:00.000Z'),
        updated_by: null
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

test.describe('entity deprecation impact permissions', () => {
  test('redacts restricted impact while retaining unrestricted governance scope', async ({
    server,
    personas,
    resources,
    deprecationSeed: _
  }) => {
    const subject = await server.db.catalog.getEntity(
      resources.workspaceId,
      resources.entityIds.apiGateway
    );
    if (!subject) throw new Error('Expected API Gateway entity to exist');

    const proposal = await personas.workspaceEditor.orpc.entityDeprecations.propose({
      params: { workspace: 'default', id: subject.id },
      body: {
        baseVersion: subject.version ?? 1,
        reason: 'Test deprecation impact visibility',
        targetDate: '2026-12-31'
      }
    });

    expect(proposal.baselineImpact).toEqual([]);
    expect(proposal.currentImpact).toEqual([]);

    const storedCase = await server.db.governance.getCase(resources.workspaceId, proposal.id);
    const storedBaselineImpact = storedCase?.payload['baselineImpact'];
    expect(storedBaselineImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: resources.entityIds.frontendApp,
          fieldName: 'Depends On',
          kind: 'reference'
        })
      ])
    );

    const privilegedProposal = await personas.globalAdmin.orpc.entityDeprecations.get({
      params: { workspace: 'default', id: subject.id }
    });
    expect(privilegedProposal?.baselineImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: resources.entityIds.frontendApp })
      ])
    );
    expect(privilegedProposal?.currentImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: resources.entityIds.frontendApp })
      ])
    );

    const authService = await server.db.catalog.getEntity(
      resources.workspaceId,
      resources.entityIds.authService
    );
    if (!authService) throw new Error('Expected Auth Service entity to exist');
    const updatedAuthService = await server.db.catalog.updateEntity(
      resources.workspaceId,
      authService.id,
      {
        slug: authService.slug,
        namespace: authService.namespace,
        name: authService.name,
        description: authService.description,
        owner: authService.owner,
        lifecycle: authService.lifecycle,
        target_lifecycle: authService.target_lifecycle,
        target_lifecycle_date: authService.target_lifecycle_date,
        tags: authService.tags,
        links: authService.links,
        schema_id: authService.schema_id,
        data: { ...authService.data, depends_on: [subject.id] },
        project_id: authService.project_id,
        updated_at: new Date('2026-08-05T00:05:00.000Z'),
        completeness: authService.completeness
      }
    );
    if (!updatedAuthService) throw new Error('Expected Auth Service update to succeed');

    const refreshedForRestrictedViewer =
      await personas.platformTeamAdmin.orpc.entityDeprecations.refreshScope({
        params: { workspace: 'default', id: subject.id, caseId: proposal.id }
      });
    expect(refreshedForRestrictedViewer.baselineImpact).toEqual([]);
    expect(refreshedForRestrictedViewer.currentImpact).toEqual([]);
    expect(refreshedForRestrictedViewer.acks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerTeamId: resources.teamIds.security,
          affectedEntityIds: []
        })
      ])
    );

    const refreshedForPrivilegedViewer = await personas.globalAdmin.orpc.entityDeprecations.get({
      params: { workspace: 'default', id: subject.id }
    });
    expect(refreshedForPrivilegedViewer?.currentImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: resources.entityIds.frontendApp }),
        expect.objectContaining({ entityId: resources.entityIds.authService })
      ])
    );
    expect(refreshedForPrivilegedViewer?.acks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerTeamId: resources.teamIds.security,
          affectedEntityIds: [resources.entityIds.authService]
        })
      ])
    );
  });
});
