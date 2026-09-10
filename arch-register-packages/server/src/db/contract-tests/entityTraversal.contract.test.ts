import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '../testSupport/fixtures';
import type { DatabaseAdapter, DbDriver } from '../database';
import {
  executeEntityTraversal,
  EntityTraversalLimitError
} from '../../domain/catalog/entityTraversal';

const runTraversal = async (
  db: DatabaseAdapter,
  workspace: string,
  rootId: string,
  schemaId: string,
  options: { maxDepth?: number; maxNodes?: number } = {}
) =>
  executeEntityTraversal(db, workspace, null, {
    root: { kind: 'ids', entityIds: [rootId] },
    ...options,
    paths: [
      {
        id: 'subtree',
        steps: [{ kind: 'containmentSubtree', fieldId: 'parent', ownerSchemaId: schemaId }],
        sourceFields: [{ context: 'entity', fieldId: '_name' }]
      }
    ]
  });

runContractSuiteAgainstBothDrivers('entityTraversal', (getDb, _driver: DbDriver) => {
  it('returns a root-inclusive recursive subtree with provenance and source values', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
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
    const rootId = randomUUID();
    const childId = randomUUID();
    const grandchildId = randomUUID();
    const root = await createFixtureEntity(db, workspace, schemaId, {
      id: rootId,
      name: 'Root',
      data: { parent: [grandchildId] }
    });
    const child = await createFixtureEntity(db, workspace, schemaId, {
      id: childId,
      name: 'Child',
      data: { parent: [rootId] }
    });
    const grandchild = await createFixtureEntity(db, workspace, schemaId, {
      id: grandchildId,
      name: 'Grandchild',
      data: { parent: [childId] }
    });
    const secondRoot = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Second root',
      data: { parent: [] }
    });
    const secondChild = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Second child',
      data: { parent: [secondRoot.id] }
    });
    const result = await executeEntityTraversal(db, workspace, null, {
      root: { kind: 'ids', entityIds: [root.id, secondRoot.id] },
      paths: [
        {
          id: 'subtree',
          steps: [{ kind: 'containmentSubtree', fieldId: 'parent', ownerSchemaId: schemaId }],
          sourceFields: [{ context: 'entity', fieldId: '_name' }]
        }
      ]
    });
    expect(result.roots).toHaveLength(2);
    const path = result.roots.find(candidate => candidate.rootId === root.id)?.paths[0];
    const secondPath = result.roots.find(candidate => candidate.rootId === secondRoot.id)?.paths[0];

    expect(path?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      root.id,
      child.id,
      grandchild.id
    ]);
    expect(path?.occurrences).toHaveLength(3);
    expect(path?.occurrences[2]?.provenance.map(hop => hop.id)).toEqual([
      root.id,
      child.id,
      grandchild.id
    ]);
    expect(path?.occurrences.map(occurrence => occurrence.terminal.source._name)).toEqual([
      'Root',
      'Child',
      'Grandchild'
    ]);
    expect(path?.cycleDetected).toBe(true);
    expect(secondPath?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      secondRoot.id,
      secondChild.id
    ]);
    expect(secondPath?.cycleDetected).toBe(false);
    expect(secondPath?.occurrences[1]?.provenance.map(hop => hop.id)).toEqual([
      secondRoot.id,
      secondChild.id
    ]);
  });

  it('selects roots with EntityQuery without applying the root filter to descendants', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
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
    const root = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Selected root',
      data: { parent: [] }
    });
    const child = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Unselected descendant',
      data: { parent: [root.id] }
    });
    await createFixtureEntity(db, workspace, schemaId, {
      name: 'Other root',
      data: { parent: [] }
    });

    const result = await executeEntityTraversal(db, workspace, null, {
      root: {
        kind: 'entityQuery',
        entityQuery: {
          schemaId,
          root: { kind: 'predicate', path: [], fieldId: '_name', op: 'equals', value: root.name }
        }
      },
      paths: [
        {
          id: 'subtree',
          steps: [{ kind: 'containmentSubtree', fieldId: 'parent', ownerSchemaId: schemaId }]
        }
      ]
    });

    expect(result.roots.map(candidate => candidate.rootId)).toEqual([root.id]);
    expect(result.roots[0]?.paths[0]?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      root.id,
      child.id
    ]);
  });

  it('applies recursive path filters to each matching witness', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
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
    const root = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Matched',
      data: { parent: [] }
    });
    const child = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Matched',
      data: { parent: [root.id] }
    });
    const excluded = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Excluded',
      data: { parent: [root.id] }
    });

    const result = await executeEntityTraversal(db, workspace, null, {
      root: { kind: 'ids', entityIds: [root.id] },
      paths: [
        {
          id: 'subtree',
          steps: [
            {
              kind: 'containmentSubtree',
              fieldId: 'parent',
              ownerSchemaId: schemaId,
              filter: {
                kind: 'predicate',
                path: [],
                fieldId: '_name',
                op: 'equals',
                value: 'Matched'
              }
            }
          ]
        }
      ]
    });

    expect(result.roots[0]?.paths[0]?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      root.id,
      child.id
    ]);
    expect(result.roots[0]?.paths[0]?.distinctTerminals.map(terminal => terminal.id)).not.toContain(
      excluded.id
    );
  });

  it('retains duplicate recursive occurrences while exposing distinct terminals', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
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
    const root = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Root',
      data: { parent: [] }
    });
    const left = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Left',
      data: { parent: [root.id] }
    });
    const right = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Right',
      data: { parent: [root.id] }
    });
    const shared = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Shared',
      data: { parent: [left.id, right.id] }
    });

    const result = await runTraversal(db, workspace, root.id, schemaId);
    const path = result.roots[0]?.paths[0];

    expect(new Set(path?.distinctTerminals.map(terminal => terminal.id))).toEqual(
      new Set([root.id, left.id, right.id, shared.id])
    );
    expect(path?.occurrences).toHaveLength(5);
    expect(path?.duplicateCount).toBe(1);
    const sharedProvenance =
      path?.occurrences
        .filter(occurrence => occurrence.terminal.id === shared.id)
        .map(occurrence => occurrence.provenance.map(hop => hop.id).join(':'))
        .sort() ?? [];
    expect(sharedProvenance).toEqual(
      [`${root.id}:${left.id}:${shared.id}`, `${root.id}:${right.id}:${shared.id}`].sort()
    );
  });

  it('keeps the contributing capability in provenance when recursion feeds a fixed relation hop', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const capabilitySchemaId = randomUUID();
    const applicationSchemaId = randomUUID();
    const relationSchemaId = randomUUID();
    await db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace,
      name: 'Supports',
      description: '',
      in_schema_ids: [capabilitySchemaId],
      out_schema_ids: [applicationSchemaId],
      fields: [],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      unique_endpoint_pair: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    await createFixtureSchema(db, workspace, {
      id: capabilitySchemaId,
      name: 'Capability',
      fields: [
        {
          id: 'parent',
          name: 'Parent',
          type: 'containment',
          schemaId: capabilitySchemaId,
          minCount: 0,
          maxCount: 1
        },
        {
          id: 'supports',
          name: 'Supports',
          type: 'typedRelation',
          relationSchemaId,
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    });
    await createFixtureSchema(db, workspace, {
      id: applicationSchemaId,
      name: 'Application'
    });

    const root = await createFixtureEntity(db, workspace, capabilitySchemaId, {
      name: 'Root capability',
      data: { parent: [] }
    });
    const child = await createFixtureEntity(db, workspace, capabilitySchemaId, {
      name: 'Child capability',
      data: { parent: [root.id] }
    });
    const grandchild = await createFixtureEntity(db, workspace, capabilitySchemaId, {
      name: 'Grandchild capability',
      data: { parent: [child.id] }
    });
    const appByCapability = await Promise.all(
      [root, child, grandchild].map(capability =>
        createFixtureEntity(db, workspace, applicationSchemaId, {
          name: `Application for ${capability.name}`
        })
      )
    );
    await Promise.all(
      [root, child, grandchild].map((capability, index) =>
        db.relation.createRelation({
          id: randomUUID(),
          workspace,
          schema_id: relationSchemaId,
          in_entity_id: capability.id,
          out_entity_id: appByCapability[index]!.id,
          data: {},
          owner: null,
          lifecycle: null,
          version: 1,
          approval_policy_override: null,
          created_at: new Date(),
          updated_at: new Date()
        })
      )
    );

    const result = await executeEntityTraversal(db, workspace, null, {
      root: { kind: 'ids', entityIds: [root.id] },
      paths: [
        {
          id: 'supportingApplications',
          steps: [
            {
              kind: 'containmentSubtree',
              fieldId: 'parent',
              ownerSchemaId: capabilitySchemaId
            },
            {
              kind: 'typedRelation',
              fieldId: 'supports',
              relationSchemaId,
              direction: 'in',
              ownerSchemaIds: [capabilitySchemaId]
            }
          ],
          sourceFields: [{ context: 'entity', fieldId: '_name' }]
        }
      ]
    });
    const path = result.roots[0]?.paths[0];

    expect(new Set(path?.distinctTerminals.map(terminal => terminal.id))).toEqual(
      new Set(appByCapability.map(application => application.id))
    );
    expect(path?.occurrences).toHaveLength(3);
    for (const [index, application] of appByCapability.entries()) {
      const expectedProvenance = [
        [root.id, application.id],
        [root.id, child.id, application.id],
        [root.id, child.id, grandchild.id, application.id]
      ][index];
      expect(
        path?.occurrences
          .find(occurrence => occurrence.terminal.id === application.id)
          ?.provenance.map(hop => hop.id)
      ).toEqual(expectedProvenance);
    }
  });

  it('excludes inaccessible branches and redacts restricted terminal source fields', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const sourceSchemaId = randomUUID();
    const targetSchemaId = randomUUID();
    const alternateSchemaId = randomUUID();
    const relationSchemaId = randomUUID();

    await db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace,
      name: 'Supports',
      description: '',
      in_schema_ids: [sourceSchemaId],
      out_schema_ids: [targetSchemaId],
      fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      unique_endpoint_pair: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    await createFixtureSchema(db, workspace, {
      id: sourceSchemaId,
      name: 'Source',
      fields: [
        {
          id: 'ref',
          name: 'References',
          type: 'reference',
          schemaId: targetSchemaId,
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'links',
          name: 'Links',
          type: 'typedRelation',
          relationSchemaId,
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    });
    await createFixtureSchema(db, workspace, {
      id: targetSchemaId,
      name: 'Target',
      fields: [{ id: 'secret', name: 'Secret', type: 'text', groupId: 'restricted' }],
      groups: [
        {
          id: 'restricted',
          name: 'Restricted',
          accessControl: { teamIds: ['secret-team'] }
        }
      ]
    });
    await createFixtureSchema(db, workspace, {
      id: alternateSchemaId,
      name: 'Alternate',
      fields: [{ id: 'secret', name: 'Secret', type: 'text' }]
    });

    const target = await createFixtureEntity(db, workspace, targetSchemaId, {
      name: 'Visible target',
      data: { secret: 'must not escape' }
    });
    const hiddenTarget = await createFixtureEntity(db, workspace, targetSchemaId, {
      name: 'Hidden target',
      data: { secret: 'hidden' }
    });
    const source = await createFixtureEntity(db, workspace, sourceSchemaId, {
      name: 'Source',
      data: { ref: [target.id, hiddenTarget.id] }
    });
    await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchemaId,
      in_entity_id: source.id,
      out_entity_id: target.id,
      data: { note: 'visible' },
      owner: null,
      lifecycle: null,
      version: 1,
      approval_policy_override: null,
      created_at: new Date(),
      updated_at: new Date()
    });
    await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchemaId,
      in_entity_id: source.id,
      out_entity_id: hiddenTarget.id,
      data: { note: 'hidden' },
      owner: null,
      lifecycle: null,
      version: 1,
      approval_policy_override: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    const sourceGrant = await db.catalog.replaceEntityGrants(workspace, source.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: source.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'self',
        created_at: new Date()
      }
    ]);
    const targetGrant = await db.catalog.replaceEntityGrants(workspace, target.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: target.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'self',
        created_at: new Date()
      }
    ]);
    const schemaRows = await db.catalog.listSchemas(workspace);
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      schemas: schemaRows,
      entities: [source, target, hiddenTarget],
      grants: [...sourceGrant, ...targetGrant]
    });

    const result = await executeEntityTraversal(db, workspace, authCtx, {
      root: { kind: 'ids', entityIds: [source.id] },
      paths: [
        {
          id: 'forward',
          steps: [{ kind: 'forward', fieldId: 'ref' }],
          sourceFields: [{ context: 'entity', fieldId: 'secret' }]
        },
        {
          id: 'typed',
          steps: [
            {
              kind: 'typedRelation',
              fieldId: 'links',
              relationSchemaId,
              direction: 'in',
              ownerSchemaIds: [sourceSchemaId]
            }
          ],
          sourceFields: [{ context: 'entity', fieldId: 'secret' }]
        }
      ]
    });
    const paths = new Map(result.roots[0]!.paths.map(path => [path.pathId, path]));

    expect(paths.get('forward')?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      target.id
    ]);
    expect(paths.get('forward')?.occurrences[0]?.terminal.source.secret).toBeNull();
    expect(paths.get('typed')?.distinctTerminals.map(terminal => terminal.id)).toEqual([target.id]);
  });

  it('fails explicitly when recursive depth or node limits would truncate results', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
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
    const rootId = randomUUID();
    const childId = randomUUID();
    const grandchildId = randomUUID();
    await createFixtureEntity(db, workspace, schemaId, {
      id: rootId,
      data: { parent: [] }
    });
    await createFixtureEntity(db, workspace, schemaId, {
      id: childId,
      data: { parent: [rootId] }
    });
    await createFixtureEntity(db, workspace, schemaId, {
      id: grandchildId,
      data: { parent: [childId] }
    });

    await expect(
      runTraversal(db, workspace, rootId, schemaId, { maxDepth: 1 })
    ).rejects.toBeInstanceOf(EntityTraversalLimitError);
    await expect(
      runTraversal(db, workspace, rootId, schemaId, { maxNodes: 2 })
    ).rejects.toBeInstanceOf(EntityTraversalLimitError);
  });

  it('preserves fixed forward, backward, and typed-relation paths in the same result contract', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const sourceSchemaId = randomUUID();
    const targetSchemaId = randomUUID();
    const relationSchemaId = randomUUID();
    await createFixtureSchema(db, workspace, {
      id: sourceSchemaId,
      name: 'Source',
      fields: [
        {
          id: 'ref',
          name: 'Reference',
          type: 'reference',
          schemaId: targetSchemaId,
          minCount: 0,
          maxCount: 1
        },
        {
          id: 'links',
          name: 'Links',
          type: 'typedRelation',
          relationSchemaId,
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    });
    await createFixtureSchema(db, workspace, { id: targetSchemaId, name: 'Target' });
    await db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace,
      name: 'Source to target',
      description: '',
      in_schema_ids: [sourceSchemaId],
      out_schema_ids: [targetSchemaId],
      fields: [
        { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' },
        {
          id: 'sourceEntity',
          name: 'Source entity',
          type: 'entityRelation',
          requirementLevel: 'optional',
          schemaId: sourceSchemaId,
          minCount: 0,
          maxCount: 1
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
    const target = await createFixtureEntity(db, workspace, targetSchemaId, { name: 'Target' });
    const source = await createFixtureEntity(db, workspace, sourceSchemaId, {
      name: 'Source',
      data: { ref: [target.id] }
    });
    await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchemaId,
      in_entity_id: source.id,
      out_entity_id: target.id,
      data: { note: 'linked', sourceEntity: [source.id] },
      owner: null,
      lifecycle: null,
      version: 1,
      approval_policy_override: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    const result = await executeEntityTraversal(db, workspace, null, {
      root: { kind: 'ids', entityIds: [source.id, target.id] },
      paths: [
        {
          id: 'forward',
          steps: [{ kind: 'forward', fieldId: 'ref' }],
          sourceFields: [{ context: 'entity', fieldId: '_name' }]
        },
        {
          id: 'backward',
          steps: [{ kind: 'backward', fieldId: 'ref', ownerSchemaId: sourceSchemaId }],
          sourceFields: [{ context: 'entity', fieldId: '_name' }]
        },
        {
          id: 'typed',
          steps: [
            {
              kind: 'typedRelation',
              fieldId: 'links',
              relationSchemaId,
              direction: 'in',
              ownerSchemaIds: [sourceSchemaId]
            }
          ],
          sourceFields: [{ context: 'entity', fieldId: '_name' }]
        },
        {
          id: 'relationTerminal',
          steps: [{ kind: 'relationBackward', fieldId: 'sourceEntity', relationSchemaId }],
          sourceFields: [{ context: 'relation', fieldId: '_id' }]
        }
      ]
    });
    const sourcePaths = new Map(
      result.roots.find(root => root.rootId === source.id)!.paths.map(path => [path.pathId, path])
    );
    const targetPaths = new Map(
      result.roots.find(root => root.rootId === target.id)!.paths.map(path => [path.pathId, path])
    );
    expect(sourcePaths.get('forward')?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      target.id
    ]);
    expect(sourcePaths.get('typed')?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      target.id
    ]);
    expect(sourcePaths.get('backward')?.occurrences).toEqual([]);
    expect(sourcePaths.get('relationTerminal')?.distinctTerminals).toEqual([
      expect.objectContaining({
        context: 'relation',
        id: expect.any(String),
        source: expect.objectContaining({ _id: expect.any(String) })
      })
    ]);
    expect(targetPaths.get('backward')?.distinctTerminals.map(terminal => terminal.id)).toEqual([
      source.id
    ]);
  });
});
