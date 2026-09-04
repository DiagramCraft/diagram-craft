import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { TraceabilityViewConfig } from '@arch-register/api-types/viewContract';
import type { BrowserEntityRecord } from './entityBrowserState';
import {
  buildTraceabilityCoverage,
  buildTraceabilityEntityQuery,
  buildTraceabilityRoots,
  groupTraceabilityOptions,
  pathStepKey,
  pruneInvalidTraceabilityPaths,
  traceabilityCompatibleRelations,
  traceabilityPathOptions,
  traceabilityPathStepContext,
  traceabilityRelationDirections
} from './traceabilityViewState';

const config: TraceabilityViewConfig = {
  paths: [
    {
      id: 'supports',
      label: 'Supports',
      path: [
        {
          kind: 'unboundTypedRelation',
          relationSchemaId: 'objective-supports-capability',
          direction: 'in'
        }
      ],
      targetSchemaIds: 'any'
    }
  ],
  deliverySources: ['projects'],
  showOrphanEntities: true,
  showOrphanProjects: true
};

const makeRoot = (id: string, projections: Record<string, unknown> = {}) =>
  ({
    _uid: id,
    _publicId: id.toUpperCase(),
    _name: id,
    _slug: id,
    _schema: { id: 'objective', name: 'Objective' },
    _projections: projections
  }) as BrowserEntityRecord;

const makeProject = (id: string, status: Project['status'] = 'active') =>
  ({ id, public_id: id, name: id, status }) as Project;

const makeRelation = (
  id: string,
  name: string,
  inSchemaIds: string[] | 'any',
  outSchemaIds: string[] | 'any'
) =>
  ({
    id,
    workspace: 'workspace',
    name,
    category: null,
    description: '',
    in: { schemaIds: inSchemaIds },
    out: { schemaIds: outSchemaIds },
    fields: [],
    groups: [],
    color: null,
    icon: null,
    relation_count: 0,
    unique_endpoint_pair: false,
    version: 1,
    created_at: '',
    updated_at: ''
  }) as RelationSchema;

const traceabilityRelations = [
  makeRelation(
    'objective-supports-capability',
    'Supports capability',
    ['objective'],
    ['capability']
  ),
  makeRelation('capability-supports-entity', 'Supports entity', ['capability'], 'any'),
  makeRelation('objective-affects-entity', 'Affects entity', ['objective'], 'any'),
  makeRelation('unrelated', 'Unrelated', ['service'], ['application'])
];

const makeSchema = (id: string, name: string, fields: EntitySchema['fields'] = []) =>
  ({ id, name, fields, groups: [] }) as unknown as EntitySchema;

describe('traceabilityViewState', () => {
  it('filters relation options by the current schema and preserves any-endpoint directions', () => {
    expect(
      traceabilityCompatibleRelations(traceabilityRelations, ['objective']).map(
        relation => relation.id
      )
    ).toEqual([
      'objective-supports-capability',
      'capability-supports-entity',
      'objective-affects-entity'
    ]);
    expect(traceabilityRelationDirections(traceabilityRelations[1]!, ['objective'])).toEqual([
      'out'
    ]);
    expect(traceabilityRelationDirections(traceabilityRelations[3]!, ['objective'])).toEqual([]);
  });

  it('enumerates unbound relation hops for a direction, scoped to the current schema', () => {
    const outOptions = traceabilityPathOptions({
      direction: 'out',
      currentSchemaScope: ['objective'],
      schemas: [],
      relationSchemas: traceabilityRelations
    });
    expect(outOptions.map(option => option.label)).toEqual(['Affects entity', 'Supports entity']);

    const inOptions = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['objective'],
      schemas: [],
      relationSchemas: traceabilityRelations
    });
    expect(inOptions.map(option => option.label)).toEqual([
      'Affects entity',
      'Supports capability'
    ]);
  });

  it('enumerates plain reference/containment field hops alongside relation hops', () => {
    const owner = makeSchema('project', 'Project', [
      {
        id: 'lead',
        name: 'lead',
        type: 'reference',
        schemaId: 'person',
        minCount: 0,
        maxCount: 1
      } as never
    ]);
    const target = makeSchema('person', 'Person');

    // 'in' renders as '→' in the hop editor's arrow toggle, so a self-owned forward field (which
    // reads left-to-right, "project -> person") is bucketed under 'in'; a reverse-lookup backward
    // field (which reads "person <- project") is bucketed under 'out'. See the comment on
    // `traceabilityPathOptions`.
    const forwardOptions = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['project'],
      schemas: [owner, target],
      relationSchemas: []
    });
    expect(forwardOptions).toEqual([
      {
        step: { kind: 'forward', fieldId: 'lead' },
        label: 'Project lead Person',
        targetSchemaIds: ['person'],
        group: 'Reference'
      }
    ]);

    const backwardOptions = traceabilityPathOptions({
      direction: 'out',
      currentSchemaScope: ['person'],
      schemas: [owner, target],
      relationSchemas: []
    });
    expect(backwardOptions).toEqual([
      {
        step: { kind: 'backward', fieldId: 'lead', ownerSchemaId: 'project' },
        // Same label as the forward direction above - it describes the field's relationship
        // (Project's "lead" field points at Person), not which way it's currently being walked.
        label: 'Project lead Person',
        targetSchemaIds: ['project'],
        group: 'Reference'
      }
    ]);
  });

  it("prefers a field's predicate over its bare name in the label (#3040)", () => {
    // A containment field named the same as its target schema (e.g. System's "Domain" field
    // pointing at the Domain schema) would otherwise read as a nonsensical self-loop, "Domain ->
    // Domain" - the field's predicate ("belongs to") disambiguates it, matching the
    // field.predicate ?? field.name convention used elsewhere (schemaGraphState.ts,
    // ExploreView.helpers.ts).
    const system = makeSchema('system', 'System', [
      {
        id: 'domain',
        name: 'Domain',
        type: 'containment',
        predicate: 'belongs to',
        schemaId: 'domain',
        minCount: 0,
        maxCount: 1
      } as never
    ]);
    const domain = makeSchema('domain', 'Domain');

    const options = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['system'],
      schemas: [system, domain],
      relationSchemas: []
    });

    expect(options.map(option => option.label)).toEqual(['System belongs to Domain']);
  });

  it('enumerates typedRelation field hops bound to the projection field, not just unbound relations', () => {
    const objective = makeSchema('objective', 'Objective', [
      {
        id: 'capability-link',
        name: 'capability-link',
        type: 'typedRelation',
        relationSchemaId: 'objective-supports-capability',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      } as never
    ]);
    const capability = makeSchema('capability', 'Capability');

    const options = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['objective'],
      schemas: [objective, capability],
      relationSchemas: traceabilityRelations
    });
    const typedOption = options.find(option => option.step.kind === 'typedRelation');
    expect(typedOption).toEqual({
      step: {
        kind: 'typedRelation',
        fieldId: 'capability-link',
        relationSchemaId: 'objective-supports-capability',
        direction: 'in',
        ownerSchemaIds: ['objective']
      },
      label: 'capability-link (Supports capability)',
      targetSchemaIds: ['capability'],
      group: 'Typed relation'
    });
  });

  it('orders options containment, then reference, then typedRelation, then unboundTypedRelation (#3040)', () => {
    const owner = makeSchema('objective', 'Objective', [
      {
        id: 'domain',
        name: 'Domain link',
        type: 'containment',
        schemaId: 'capability',
        minCount: 0,
        maxCount: 1
      } as never,
      {
        id: 'vendor',
        name: 'Vendor link',
        type: 'reference',
        schemaId: 'capability',
        minCount: 0,
        maxCount: 1
      } as never,
      {
        id: 'capability-link',
        name: 'Capability link',
        type: 'typedRelation',
        relationSchemaId: 'objective-affects-entity',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      } as never
    ]);
    const capability = makeSchema('capability', 'Capability');

    const options = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['objective'],
      schemas: [owner, capability],
      relationSchemas: traceabilityRelations
    });

    // 'Affects entity' (the unbound form of 'objective-affects-entity') is deliberately absent:
    // the 'Capability link' typedRelation field already fully covers this scope for that same
    // relation+direction, so the unbound duplicate is suppressed (see the dedup test below).
    expect(options.map(option => option.label)).toEqual([
      'Objective Domain link Capability',
      'Objective Vendor link Capability',
      'Capability link (Affects entity)',
      'Supports capability'
    ]);

    expect(
      groupTraceabilityOptions(options).map(({ group, options: grouped }) => ({
        group,
        labels: grouped.map(option => option.label)
      }))
    ).toEqual([
      { group: 'Containment', labels: ['Objective Domain link Capability'] },
      { group: 'Reference', labels: ['Objective Vendor link Capability'] },
      { group: 'Typed relation', labels: ['Capability link (Affects entity)'] },
      { group: 'Relation', labels: ['Supports capability'] }
    ]);
  });

  it('suppresses the unbound relation option once every scope schema has a viewable typed field for it (#3040)', () => {
    const objective = makeSchema('objective', 'Objective', [
      {
        id: 'affects-link',
        name: 'Affects',
        type: 'typedRelation',
        relationSchemaId: 'objective-affects-entity',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      } as never
    ]);

    const options = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['objective'],
      schemas: [objective],
      relationSchemas: [traceabilityRelations[2]!] // objective-affects-entity only
    });

    expect(options.map(option => option.step.kind)).toEqual(['typedRelation']);
  });

  it('keeps the unbound relation option when only some scope schemas have the typed field (#3040)', () => {
    const objective = makeSchema('objective', 'Objective', [
      {
        id: 'affects-link',
        name: 'Affects',
        type: 'typedRelation',
        relationSchemaId: 'objective-affects-entity',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      } as never
    ]);
    // 'capability' is also in scope (a mixed-root path) but has no 'Affects' field of its own, so
    // the unbound hop is still needed to reach entities linked via that schema.
    const capability = makeSchema('capability', 'Capability');

    const options = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['objective', 'capability'],
      schemas: [objective, capability],
      relationSchemas: [traceabilityRelations[2]!] // objective-affects-entity only
    });

    expect(options.map(option => option.step.kind).sort()).toEqual([
      'typedRelation',
      'unboundTypedRelation'
    ]);
  });

  it('excludes fields in an access-restricted group from the option list', () => {
    const owner = makeSchema('project', 'Project', [
      {
        id: 'lead',
        name: 'lead',
        type: 'reference',
        schemaId: 'person',
        minCount: 0,
        maxCount: 1,
        groupId: 'restricted'
      } as never
    ]);
    owner.groups = [{ id: 'restricted', name: 'Restricted', accessControl: {} } as never];
    const target = makeSchema('person', 'Person');

    const options = traceabilityPathOptions({
      direction: 'in',
      currentSchemaScope: ['project'],
      schemas: [owner, target],
      relationSchemas: [],
      getFieldGroupAccess: () => 'none'
    });
    expect(options).toEqual([]);
  });

  it('propagates the selected endpoint schema to the next hop', () => {
    const path = {
      id: 'strategy',
      label: 'Strategy',
      path: [
        {
          kind: 'unboundTypedRelation' as const,
          relationSchemaId: 'objective-supports-capability',
          direction: 'in' as const
        }
      ],
      targetSchemaIds: 'any' as const
    };

    const context = traceabilityPathStepContext({
      rootSchemaScope: ['objective'],
      path,
      depth: 1,
      schemas: [],
      relationSchemas: traceabilityRelations
    });

    expect(context.currentSchemaScope).toEqual(['capability']);
    expect(context.availableDirections).toEqual(['in', 'out']);
  });

  it('uses the compatible union for mixed roots and marks invalid saved steps', () => {
    const path = {
      id: 'invalid',
      label: 'Invalid',
      path: [
        {
          kind: 'unboundTypedRelation' as const,
          relationSchemaId: 'capability-supports-entity',
          direction: 'in' as const
        }
      ],
      targetSchemaIds: 'any' as const
    };

    const context = traceabilityPathStepContext({
      rootSchemaScope: ['objective', 'capability'],
      path,
      depth: 0,
      schemas: [],
      relationSchemas: traceabilityRelations
    });

    expect(context.invalid).toBe(false);
    expect(
      context.options.some(option => pathStepKey(option.step) === pathStepKey(path.path[0]!))
    ).toBe(true);

    const invalidContext = traceabilityPathStepContext({
      rootSchemaScope: ['objective'],
      path,
      depth: 0,
      schemas: [],
      relationSchemas: traceabilityRelations
    });
    expect(invalidContext.invalid).toBe(true);
  });

  it('truncates a path to its longest still-valid prefix when a later hop becomes invalid (#3040)', () => {
    const twoHopConfig: TraceabilityViewConfig = {
      ...config,
      paths: [
        {
          id: 'strategy',
          label: 'Strategy',
          path: [
            {
              kind: 'unboundTypedRelation',
              relationSchemaId: 'objective-supports-capability',
              direction: 'in'
            },
            {
              kind: 'unboundTypedRelation',
              relationSchemaId: 'objective-affects-entity',
              direction: 'in'
            }
          ],
          targetSchemaIds: 'any'
        }
      ]
    };

    // Hop 1 lands on 'capability' (objective-supports-capability's 'out' endpoint). Hop 2
    // ('objective-affects-entity', 'in') requires the current schema to be in that relation's
    // 'in' endpoint (['objective']) - it isn't reachable from 'capability', so it's invalid
    // regardless of root scope; this is the same shape of break a sidebar filter change produces
    // (a hop that was reachable stops being so once something upstream shifts).
    const pruned = pruneInvalidTraceabilityPaths(twoHopConfig, {
      rootSchemaScope: ['objective'],
      schemas: [],
      relationSchemas: traceabilityRelations
    });

    expect(pruned.paths).toEqual([
      {
        id: 'strategy',
        label: 'Strategy',
        path: [
          {
            kind: 'unboundTypedRelation',
            relationSchemaId: 'objective-supports-capability',
            direction: 'in'
          }
        ],
        targetSchemaIds: 'any'
      }
    ]);
  });

  it('drops a path entirely when even its first hop is invalid, and no-ops when nothing changed (#3040)', () => {
    const invalidFirstHopConfig: TraceabilityViewConfig = {
      ...config,
      paths: [
        {
          id: 'broken',
          label: 'Broken',
          path: [
            {
              kind: 'unboundTypedRelation',
              relationSchemaId: 'capability-supports-entity',
              direction: 'in'
            }
          ],
          targetSchemaIds: 'any'
        }
      ]
    };

    const pruned = pruneInvalidTraceabilityPaths(invalidFirstHopConfig, {
      rootSchemaScope: ['objective'],
      schemas: [],
      relationSchemas: traceabilityRelations
    });
    expect(pruned.paths).toEqual([]);

    // Nothing invalid here - the same config reference comes back so callers can skip a
    // no-op config write (and avoid re-triggering whatever effect called this).
    const unchanged = pruneInvalidTraceabilityPaths(config, {
      rootSchemaScope: ['objective'],
      schemas: [],
      relationSchemas: traceabilityRelations
    });
    expect(unchanged).toBe(config);
  });

  it('adds a single correlated path projection per path', () => {
    const query: EntityQuery = { root: { kind: 'and', children: [] } };
    const result = buildTraceabilityEntityQuery(query, config);

    expect(result.aliases).toEqual([
      { pathId: 'supports', alias: '__traceability__supports:path' }
    ]);
    expect(result.query?.projections).toEqual([
      expect.objectContaining({
        fieldId: '_id',
        alias: '__traceability__supports:path',
        includePath: true,
        path: config.paths[0]!.path
      })
    ]);
  });

  it('keeps multi-hop paths grouped by branch instead of pooling them into one flat list (#3040)', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('domain-1', {
          '__traceability__supports:path': [
            [
              { id: 'system-a', name: 'API Gateway', schemaId: 'system' },
              { id: 'component-a', name: 'Gateway Router', schemaId: 'component' }
            ],
            [
              { id: 'system-b', name: 'Feature Flag Service', schemaId: 'system' },
              { id: 'component-b', name: 'Flag Evaluator', schemaId: 'component' }
            ]
          ]
        })
      ],
      queryResult.aliases,
      config
    );

    expect(roots[0]!.paths[0]!.includedPaths).toEqual([
      [
        { id: 'system-a', name: 'API Gateway', schemaId: 'system' },
        { id: 'component-a', name: 'Gateway Router', schemaId: 'component' }
      ],
      [
        { id: 'system-b', name: 'Feature Flag Service', schemaId: 'system' },
        { id: 'component-b', name: 'Flag Evaluator', schemaId: 'component' }
      ]
    ]);
    expect(roots[0]!.graphNodeIds).toEqual(
      new Set(['domain-1', 'system-a', 'component-a', 'system-b', 'component-b'])
    );
  });

  it("filters matched paths by the path's target schema, keyed off the leaf hop (#3040)", () => {
    const targetedConfig: TraceabilityViewConfig = {
      ...config,
      paths: [{ ...config.paths[0]!, targetSchemaIds: ['component'] }]
    };
    const queryResult = buildTraceabilityEntityQuery(null, targetedConfig);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('domain-1', {
          '__traceability__supports:path': [
            [
              { id: 'system-a', name: 'API Gateway', schemaId: 'system' },
              { id: 'component-a', name: 'Gateway Router', schemaId: 'component' }
            ],
            // A single-hop path landing on a System, not a Component - excluded since it doesn't
            // reach the configured target schema, even though it's otherwise a valid match.
            [{ id: 'system-b', name: 'Feature Flag Service', schemaId: 'system' }]
          ]
        })
      ],
      queryResult.aliases,
      targetedConfig
    );

    expect(roots[0]!.paths[0]!.includedPaths).toEqual([
      [
        { id: 'system-a', name: 'API Gateway', schemaId: 'system' },
        { id: 'component-a', name: 'Gateway Router', schemaId: 'component' }
      ]
    ]);
    expect(roots[0]!.graphNodeIds).toEqual(new Set(['domain-1', 'system-a', 'component-a']));
  });

  it('sorts paths hop-by-hop so branches sharing an early hop stay adjacent (#3040)', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    // DB aggregate order is unspecified - shuffled here to prove sorting isn't relying on
    // incidental row order, and 'Customer Portal' appears as the first hop of several paths to
    // reproduce the reported symptom (same System scattered across unrelated rows in the cell).
    const roots = buildTraceabilityRoots(
      [
        makeRoot('domain-1', {
          '__traceability__supports:path': [
            [
              { id: 'sys-cp', name: 'Customer Portal' },
              { id: 'c4', name: 'Rate Limiter' }
            ],
            [
              { id: 'sys-nh', name: 'Notification Hub' },
              { id: 'c2', name: 'Webhook Relay' }
            ],
            [
              { id: 'sys-cp', name: 'Customer Portal' },
              { id: 'c1', name: 'API Gateway' }
            ],
            [
              { id: 'sys-sp', name: 'Search Platform' },
              { id: 'c5', name: 'Search Service' }
            ],
            [
              { id: 'sys-cp', name: 'Customer Portal' },
              { id: 'c3', name: 'Feature Flag Service' }
            ]
          ]
        })
      ],
      queryResult.aliases,
      config
    );

    expect(roots[0]!.paths[0]!.includedPaths.map(path => path.map(node => node.name))).toEqual([
      ['Customer Portal', 'API Gateway'],
      ['Customer Portal', 'Feature Flag Service'],
      ['Customer Portal', 'Rate Limiter'],
      ['Notification Hub', 'Webhook Relay'],
      ['Search Platform', 'Search Service']
    ]);
  });

  it('builds path nodes and separates architecture and delivery coverage', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('objective-1', {
          '__traceability__supports:path': [[{ id: 'capability-1', name: 'Capability 1' }]]
        }),
        makeRoot('objective-2')
      ],
      queryResult.aliases,
      config
    );
    const project = makeProject('project-1');
    const coverage = buildTraceabilityCoverage({
      roots,
      projects: [project],
      memberships: new Map([['project-1', ['capability-1']]])
    });

    expect(coverage.rows[0]).toMatchObject({
      architectureCovered: true,
      deliveryCovered: true,
      alignedProjects: [project]
    });
    expect(coverage.rows[1]).toMatchObject({
      architectureCovered: false,
      deliveryCovered: false,
      alignedProjects: []
    });
  });

  it('matches projects against any node in the traceability graph and reports orphan projects', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('objective-1', {
          '__traceability__supports:path': [[{ id: 'capability-1', name: 'Capability 1' }]]
        })
      ],
      queryResult.aliases,
      config
    );
    const aligned = makeProject('aligned');
    const orphan = makeProject('orphan');
    const coverage = buildTraceabilityCoverage({
      roots,
      projects: [aligned, orphan],
      memberships: new Map([
        [aligned.id, ['objective-1']],
        [orphan.id, ['unrelated-entity']]
      ])
    });

    expect(coverage.rows[0]?.alignedProjects).toEqual([aligned]);
    expect(coverage.orphanProjectIds).toEqual(new Set(['orphan']));
  });

  it('treats delivery as covered when aligned projects are complete, not just active', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('objective-1', {
          '__traceability__supports:path': [[{ id: 'capability-1', name: 'Capability 1' }]]
        })
      ],
      queryResult.aliases,
      config
    );
    const complete = makeProject('complete-1', 'complete');
    const coverage = buildTraceabilityCoverage({
      roots,
      projects: [complete],
      memberships: new Map([[complete.id, ['capability-1']]])
    });

    expect(coverage.rows[0]).toMatchObject({
      deliveryCovered: true,
      deliveringProjects: [complete]
    });
  });

  it('treats delivery as a gap when every aligned project was cancelled', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('objective-1', {
          '__traceability__supports:path': [[{ id: 'capability-1', name: 'Capability 1' }]]
        })
      ],
      queryResult.aliases,
      config
    );
    const cancelled = makeProject('cancelled-1', 'cancelled');
    const coverage = buildTraceabilityCoverage({
      roots,
      projects: [cancelled],
      memberships: new Map([[cancelled.id, ['capability-1']]])
    });

    expect(coverage.rows[0]).toMatchObject({
      deliveryCovered: false,
      deliveringProjects: []
    });
  });

  it('computes completion rate as the share of aligned projects that are complete', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('objective-1', {
          '__traceability__supports:path': [[{ id: 'capability-1', name: 'Capability 1' }]]
        }),
        makeRoot('objective-2', {
          '__traceability__supports:path': [[{ id: 'capability-2', name: 'Capability 2' }]]
        }),
        makeRoot('objective-3')
      ],
      queryResult.aliases,
      config
    );
    const complete = makeProject('complete-1', 'complete');
    const active = makeProject('active-1', 'active');
    const coverage = buildTraceabilityCoverage({
      roots,
      projects: [complete, active],
      memberships: new Map([
        [complete.id, ['capability-1']],
        [active.id, ['capability-1', 'capability-2']]
      ])
    });

    // objective-1: one of two aligned projects complete
    expect(coverage.rows[0]?.completionRate).toBe(0.5);
    // objective-2: aligned project is active, none complete
    expect(coverage.rows[1]?.completionRate).toBe(0);
    // objective-3: no aligned projects
    expect(coverage.rows[2]?.completionRate).toBeNull();
  });
});
