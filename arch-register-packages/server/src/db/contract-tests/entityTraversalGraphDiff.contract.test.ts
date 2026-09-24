import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { diffSubjectTraversal } from '../../domain/catalog/entityTraversalGraphDiffOperations';
import { EntityTraversalLimitError } from '../../domain/catalog/entityTraversal';
import { relationToBaseState } from '../../domain/catalog/relationHelpers';
import type { DatabaseAdapter } from '../database';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureProject,
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '../testSupport/fixtures';

const createPlannedChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  record: { id: string; version?: number },
  proposedState: Record<string, unknown>,
  projectId: string
) =>
  db.changeCase.createCase({
    id: randomUUID(),
    workspace,
    project_id: projectId,
    name: 'Candidate graph change',
    description: null,
    effective_date: '2099-01-01',
    milestone_id: null,
    message: null,
    created_by: null,
    created_at: new Date(),
    members: [
      {
        entity_id: record.id,
        base_version: record.version ?? 1,
        base_state: { id: record.id },
        proposed_state: proposedState,
        diff: {}
      }
    ]
  });

const createRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  inSchemaId: string,
  outSchemaId: string
) => {
  const id = randomUUID();
  await db.relation.createRelationSchema({
    id,
    workspace,
    name: `Relation ${id}`,
    description: '',
    in_schema_ids: [inSchemaId],
    out_schema_ids: [outSchemaId],
    fields: [
      {
        id: 'sourceLink',
        name: 'Source entity',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: inSchemaId,
        minCount: 0,
        maxCount: 1
      },
      {
        id: 'carried',
        name: 'Carried entities',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: outSchemaId,
        minCount: 0,
        maxCount: -1
      }
    ],
    groups: [],
    shared_field_group_links: [],
    color: null,
    icon: null,
    relation_approval_policy: 'disabled',
    unique_endpoint_pair: false,
    created_at: new Date(),
    updated_at: new Date()
  });
  return id;
};

runContractSuiteAgainstBothDrivers('entityTraversalGraphDiff', getDb => {
  it('diffs reachable routes and applies only the selected active revision', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const ownerTeamId = randomUUID();
    await db.workspace.replaceTeams(workspace, [
      {
        id: ownerTeamId,
        workspace,
        name: 'Project owners',
        sort_order: 0,
        color: null,
        description: '',
        created_at: new Date()
      }
    ]);
    const projectId = (await createFixtureProject(db, workspace, { owner: ownerTeamId })).id;
    const schemaId = randomUUID();
    await createFixtureSchema(db, workspace, {
      id: schemaId,
      name: 'Service',
      fields: [
        {
          id: 'first',
          name: 'First hop',
          type: 'reference',
          schemaId,
          minCount: 0,
          maxCount: 1
        },
        {
          id: 'next',
          name: 'Next hop',
          type: 'reference',
          schemaId,
          minCount: 0,
          maxCount: 1
        },
        {
          id: 'secretLink',
          name: 'Restricted target',
          type: 'reference',
          schemaId,
          minCount: 0,
          maxCount: 1
        }
      ]
    });
    const target = await createFixtureEntity(db, workspace, schemaId, { data: {} });
    const hiddenTarget = await createFixtureEntity(db, workspace, schemaId, { data: {} });
    const beforeBranch = await createFixtureEntity(db, workspace, schemaId, {
      data: { next: [target.id] }
    });
    const afterBranch = await createFixtureEntity(db, workspace, schemaId, {
      data: { next: [target.id] }
    });
    const root = await createFixtureEntity(db, workspace, schemaId, {
      data: { first: [beforeBranch.id] }
    });
    const decoyBranch = await createFixtureEntity(db, workspace, schemaId, { data: {} });

    const candidate = await createPlannedChangeCase(
      db,
      workspace,
      root,
      { data: { first: [afterBranch.id], secretLink: [hiddenTarget.id] } },
      projectId
    );
    await createPlannedChangeCase(
      db,
      workspace,
      root,
      {
        data: { first: [decoyBranch.id] }
      },
      projectId
    );

    const visibleEntities = [root, beforeBranch, afterBranch, target, decoyBranch];
    const grants = await Promise.all(
      visibleEntities.map(entity =>
        db.catalog.replaceEntityGrants(workspace, entity.id, [
          {
            id: randomUUID(),
            workspace,
            entity_id: entity.id,
            principal_type: 'user',
            principal_id: user.id,
            role: 'editor',
            applies_to: 'self',
            created_at: new Date()
          }
        ])
      )
    );
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: ownerTeamId, role: 'team_admin' }],
      schemas: await db.catalog.listSchemas(workspace),
      entities: visibleEntities,
      grants: grants.flat()
    });

    const result = await diffSubjectTraversal(db, workspace, authCtx, {
      subject: { kind: 'changeCase', caseId: candidate.id },
      paths: [
        {
          id: 'route',
          steps: [
            { kind: 'forward', fieldId: 'first' },
            { kind: 'forward', fieldId: 'next' }
          ]
        },
        {
          id: 'restricted-link',
          steps: [{ kind: 'forward', fieldId: 'secretLink' }]
        }
      ]
    });

    expect(result.nodes.added.map(change => change.node.id)).toContain(afterBranch.id);
    expect(result.nodes.added.map(change => change.node.id)).not.toContain(decoyBranch.id);
    expect(JSON.stringify(result)).not.toContain(hiddenTarget.id);
    expect(result.nodes.removed.map(change => change.node.id)).toContain(beforeBranch.id);
    expect(result.nodes.pathChanged).toEqual([
      expect.objectContaining({
        node: expect.objectContaining({ id: target.id }),
        beforePath: {
          pathId: 'route',
          hops: [
            expect.objectContaining({ id: root.id }),
            expect.objectContaining({ id: beforeBranch.id }),
            expect.objectContaining({ id: target.id })
          ]
        },
        afterPath: {
          pathId: 'route',
          hops: [
            expect.objectContaining({ id: root.id }),
            expect.objectContaining({ id: afterBranch.id }),
            expect.objectContaining({ id: target.id })
          ]
        }
      })
    ]);
    expect(result.edges.added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: expect.objectContaining({ id: root.id }),
          to: expect.objectContaining({ id: afterBranch.id })
        }),
        expect.objectContaining({
          from: expect.objectContaining({ id: afterBranch.id }),
          to: expect.objectContaining({ id: target.id })
        })
      ])
    );
    expect(result.edges.removed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: expect.objectContaining({ id: root.id }),
          to: expect.objectContaining({ id: beforeBranch.id })
        }),
        expect.objectContaining({
          from: expect.objectContaining({ id: beforeBranch.id }),
          to: expect.objectContaining({ id: target.id })
        })
      ])
    );
  });

  it('enforces traversal limits on the reconstructed candidate graph', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const projectId = (await createFixtureProject(db, workspace)).id;
    const schemaId = randomUUID();
    await createFixtureSchema(db, workspace, {
      id: schemaId,
      name: 'Capability',
      fields: [
        {
          id: 'parent',
          name: 'Parent',
          type: 'containment',
          schemaId,
          minCount: 0,
          maxCount: 1
        }
      ]
    });
    const root = await createFixtureEntity(db, workspace, schemaId, { data: { parent: [] } });
    const child = await createFixtureEntity(db, workspace, schemaId, { data: { parent: [] } });
    const candidate = await createPlannedChangeCase(
      db,
      workspace,
      child,
      {
        data: { parent: [root.id] }
      },
      projectId
    );

    await expect(
      diffSubjectTraversal(db, workspace, null, {
        subject: { kind: 'entity', entityId: root.id },
        candidateCaseId: candidate.id,
        paths: [
          {
            id: 'subtree',
            steps: [{ kind: 'containmentSubtree', fieldId: 'parent', ownerSchemaId: schemaId }]
          }
        ],
        maxNodes: 1
      })
    ).rejects.toBeInstanceOf(EntityTraversalLimitError);
  });

  it('traverses relation fields reconstructed with the selected candidate revision', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const projectId = (await createFixtureProject(db, workspace)).id;
    const sourceSchemaId = await createFixtureSchema(db, workspace, { name: 'System' });
    const targetSchemaId = await createFixtureSchema(db, workspace, { name: 'Data' });
    const relationSchemaId = await createRelationSchema(
      db,
      workspace,
      sourceSchemaId,
      targetSchemaId
    );
    const source = await createFixtureEntity(db, workspace, sourceSchemaId);
    const otherEndpoint = await createFixtureEntity(db, workspace, sourceSchemaId);
    const target = await createFixtureEntity(db, workspace, targetSchemaId);
    const relation = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchemaId,
      in_entity_id: source.id,
      out_entity_id: otherEndpoint.id,
      data: { sourceLink: [source.id], carried: [] },
      created_at: new Date(),
      updated_at: new Date()
    });
    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      record_id: relation.id,
      version_number: relation.version,
      kind: 'direct_edit',
      commit_message: null,
      created_at: relation.created_at,
      created_by: null,
      state: relationToBaseState(relation),
      applied_case_revision_id: null
    });
    const candidate = await createPlannedChangeCase(
      db,
      workspace,
      relation,
      {
        data: { sourceLink: [source.id], carried: [target.id] }
      },
      projectId
    );

    const result = await diffSubjectTraversal(db, workspace, null, {
      subject: { kind: 'entity', entityId: source.id },
      candidateCaseId: candidate.id,
      paths: [
        {
          id: 'carried-data',
          steps: [
            { kind: 'relationBackward', relationSchemaId, fieldId: 'sourceLink' },
            { kind: 'relationForward', fieldId: 'carried' }
          ]
        }
      ]
    });

    expect(result.nodes.added.map(change => change.node)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ context: 'relation', id: relation.id }),
        expect.objectContaining({ context: 'entity', id: target.id })
      ])
    );
    expect(result.edges.added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: expect.objectContaining({ id: source.id }),
          to: expect.objectContaining({ context: 'relation', id: relation.id })
        }),
        expect.objectContaining({
          from: expect.objectContaining({ context: 'relation', id: relation.id }),
          to: expect.objectContaining({ id: target.id })
        })
      ])
    );
  });
});
