import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { TraceabilityViewConfig } from '@arch-register/api-types/viewContract';
import type { BrowserEntityRecord } from './entityBrowserState';
import {
  buildTraceabilityCoverage,
  buildTraceabilityEntityQuery,
  buildTraceabilityRoots,
  traceabilityAvailableDirections,
  traceabilityCompatibleRelations,
  traceabilityCompatibleRelationsForDirection,
  traceabilityPathStepContext,
  traceabilityRelationIdForDirection,
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
      targetSchemaIds: ['capability']
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
    expect(traceabilityAvailableDirections(traceabilityRelations, ['objective'])).toEqual([
      'in',
      'out'
    ]);
    expect(
      traceabilityCompatibleRelationsForDirection(traceabilityRelations, ['objective'], 'in').map(
        relation => relation.id
      )
    ).toEqual(['objective-supports-capability', 'objective-affects-entity']);
    expect(
      traceabilityCompatibleRelationsForDirection(traceabilityRelations, ['objective'], 'out').map(
        relation => relation.id
      )
    ).toEqual(['capability-supports-entity', 'objective-affects-entity']);
    expect(
      traceabilityRelationIdForDirection(
        traceabilityRelations,
        ['objective'],
        'out',
        'objective-affects-entity'
      )
    ).toBe('objective-affects-entity');
    expect(
      traceabilityRelationIdForDirection(traceabilityRelations, ['objective'], 'out', 'missing')
    ).toBe('capability-supports-entity');
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
      relationSchemas: traceabilityRelations
    });

    expect(context.currentSchemaScope).toEqual(['capability']);
    expect(context.compatibleRelations.map(relation => relation.id)).toEqual([
      'objective-supports-capability',
      'capability-supports-entity',
      'objective-affects-entity'
    ]);
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
      relationSchemas: traceabilityRelations
    });

    expect(context.invalid).toBe(false);
    expect(context.compatibleDirections).toEqual(['in', 'out']);

    const invalidContext = traceabilityPathStepContext({
      rootSchemaScope: ['objective'],
      path,
      depth: 0,
      relationSchemas: traceabilityRelations
    });
    expect(invalidContext.invalid).toBe(true);
    expect(invalidContext.compatibleDirections).toEqual(['out']);
  });

  it('adds bounded id and name projections for each configured path prefix', () => {
    const query: EntityQuery = { root: { kind: 'and', children: [] } };
    const result = buildTraceabilityEntityQuery(query, config);

    expect(result.aliases).toEqual([
      {
        pathId: 'supports',
        depth: 0,
        id: '__traceability__supports:0:id',
        name: '__traceability__supports:0:name'
      }
    ]);
    expect(result.query?.projections).toEqual([
      expect.objectContaining({ fieldId: '_id', alias: '__traceability__supports:0:id' }),
      expect.objectContaining({ fieldId: '_name', alias: '__traceability__supports:0:name' })
    ]);
  });

  it('builds path nodes and separates architecture and delivery coverage', () => {
    const queryResult = buildTraceabilityEntityQuery(null, config);
    const roots = buildTraceabilityRoots(
      [
        makeRoot('objective-1', {
          '__traceability__supports:0:id': ['capability-1'],
          '__traceability__supports:0:name': ['Capability 1']
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
          '__traceability__supports:0:id': ['capability-1'],
          '__traceability__supports:0:name': ['Capability 1']
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
});
