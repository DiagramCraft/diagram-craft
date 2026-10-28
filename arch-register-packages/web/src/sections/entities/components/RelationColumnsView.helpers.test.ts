import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityRelationData } from '../../../hooks/useEntities';
import {
  buildExploreGraph,
  buildRelationKey,
  normalizeExploreConfig,
  parseExploreConfigValue
} from './RelationColumnsView.helpers';

const entity = (
  id: string,
  name: string,
  schemaId = 'application',
  publicId = `${id.toUpperCase()}`
): EntityRecord =>
  ({
    _uid: id,
    _publicId: publicId,
    _schema: { id: schemaId, name: schemaId },
    _name: name,
    _slug: name.toLowerCase().replace(/\s+/g, '-'),
    _namespace: 'core',
    _description: '',
    _owner: null,
    _lifecycle: null,
    _targetLifecycle: null,
    _targetLifecycleDate: null,
    _tags: [],
    _links: [],
    _visibilityMode: 'public',
    _projectId: null,
    _completeness: null,
    canView: true,
    canEdit: true,
    canDelete: true,
    canAdmin: true,
    canCreateChild: true
  }) as EntityRecord;

const relationMap = (entries: Record<string, Partial<EntityRelationData>>) =>
  new Map<string, EntityRelationData>(
    Object.entries(entries).map(([entityId, value]) => [
      entityId,
      {
        incoming: value.incoming ?? [],
        outgoing: value.outgoing ?? [],
        isLoading: false
      }
    ])
  );

describe('buildExploreGraph', () => {
  it('keeps the filtered entities as the center column', () => {
    const centerEntities = [entity('a', 'App A'), entity('b', 'App B')];

    const graph = buildExploreGraph({
      centerEntities,
      relationsMap: relationMap({}),
      config: { leftDepth: 1, rightDepth: 1 }
    });

    expect(
      graph.columns.find(column => column.index === 0)?.entities.map(entity => entity.entityId)
    ).toEqual(['a', 'b']);
  });

  it('excludes entities from every explore column and connector', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A'), entity('b', 'App B')],
      relationsMap: relationMap({
        a: {
          outgoing: [
            {
              entityId: 'related',
              publicId: 'RELATED',
              entitySlug: 'related',
              entityName: 'Related',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        }
      }),
      config: { leftDepth: 0, rightDepth: 1 },
      excludedEntityIds: new Set(['a', 'related'])
    });

    expect(graph.columns.find(column => column.index === 0)?.entities.map(e => e.entityId)).toEqual(
      ['b']
    );
    expect(graph.columns.find(column => column.index === 1)?.entities).toEqual([]);
    expect(graph.connectors).toHaveLength(0);
  });

  it('uses incoming relations on the left and outgoing relations on the right', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          incoming: [
            {
              entityId: 'left-1',
              publicId: 'LEFT1',
              entitySlug: 'left-1',
              entityName: 'Left 1',
              entitySchemaId: 'service',
              fieldName: 'Used By',
              kind: 'reference'
            }
          ],
          outgoing: [
            {
              entityId: 'right-1',
              publicId: 'RIGHT1',
              entitySlug: 'right-1',
              entityName: 'Right 1',
              entitySchemaId: 'database',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        }
      }),
      config: { leftDepth: 1, rightDepth: 1 }
    });

    expect(
      graph.columns.find(column => column.index === -1)?.entities.map(entity => entity.entityId)
    ).toEqual(['left-1']);
    expect(
      graph.columns.find(column => column.index === 1)?.entities.map(entity => entity.entityId)
    ).toEqual(['right-1']);
    expect(graph.connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromColumn: -1,
          fromEntityId: 'left-1',
          toColumn: 0,
          toEntityId: 'a'
        }),
        expect.objectContaining({
          fromColumn: 0,
          fromEntityId: 'a',
          toColumn: 1,
          toEntityId: 'right-1'
        })
      ])
    );
  });

  it('includes typed relations by default and when explicitly selected', () => {
    const relationsMap = relationMap({
      a: {
        outgoing: [
          {
            entityId: 'right-1',
            publicId: 'RIGHT1',
            entitySlug: 'right-1',
            entityName: 'Right 1',
            entitySchemaId: 'service',
            fieldName: 'Data Flow',
            kind: 'typed',
            relationSchemaColor: '#ff0000'
          }
        ]
      }
    });

    const defaultGraph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap,
      config: { leftDepth: 0, rightDepth: 1 }
    });
    expect(
      defaultGraph.columns.find(column => column.index === 1)?.entities.map(e => e.entityId)
    ).toEqual(['right-1']);
  });

  it('adds one more derived hop only on the expanded side', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          incoming: [
            {
              entityId: 'left-1',
              publicId: 'LEFT1',
              entitySlug: 'left-1',
              entityName: 'Left 1',
              entitySchemaId: 'service',
              fieldName: 'Used By',
              kind: 'reference'
            }
          ],
          outgoing: []
        },
        'left-1': {
          incoming: [
            {
              entityId: 'left-2',
              publicId: 'LEFT2',
              entitySlug: 'left-2',
              entityName: 'Left 2',
              entitySchemaId: 'service',
              fieldName: 'Used By',
              kind: 'reference'
            }
          ],
          outgoing: []
        }
      }),
      config: { leftDepth: 2, rightDepth: 1 }
    });

    expect(
      graph.columns.find(column => column.index === -2)?.entities.map(entity => entity.entityId)
    ).toEqual(['left-2']);
    expect(graph.columns.find(column => column.index === 2)).toBeUndefined();
  });

  it('filters traversal by schema-level relation', () => {
    const keep = {
      entityId: 'keep-me',
      publicId: 'KEEP1',
      entitySlug: 'keep-me',
      entityName: 'Keep Me',
      entitySchemaId: 'service',
      fieldName: 'Depends On',
      kind: 'reference' as const
    };
    const drop = {
      ...keep,
      entityId: 'drop-me',
      publicId: 'DROP1',
      entitySlug: 'drop-me',
      entityName: 'Drop Me'
    };
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({ a: { outgoing: [keep, drop] } }),
      config: {
        leftDepth: 0,
        rightDepth: 1,
        columnRelationKeys: { '1': [buildRelationKey('application', 'service', keep)] }
      }
    });

    expect(
      graph.columns.find(column => column.index === 1)?.entities.map(item => item.entityId)
    ).toEqual(['keep-me', 'drop-me']);
    expect(graph.connectors).toHaveLength(2);
  });

  it('filters each side by its selected target schema and exposes candidate schemas', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          incoming: [
            {
              entityId: 'left-service',
              publicId: 'LEFT-SERVICE',
              entitySlug: 'left-service',
              entityName: 'Left Service',
              entitySchemaId: 'service',
              fieldName: 'Used By',
              kind: 'reference'
            },
            {
              entityId: 'left-database',
              publicId: 'LEFT-DATABASE',
              entitySlug: 'left-database',
              entityName: 'Left Database',
              entitySchemaId: 'database',
              fieldName: 'Used By',
              kind: 'reference'
            }
          ],
          outgoing: [
            {
              entityId: 'right-service',
              publicId: 'RIGHT-SERVICE',
              entitySlug: 'right-service',
              entityName: 'Right Service',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            },
            {
              entityId: 'right-database',
              publicId: 'RIGHT-DATABASE',
              entitySlug: 'right-database',
              entityName: 'Right Database',
              entitySchemaId: 'database',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        }
      }),
      config: {
        leftDepth: 1,
        rightDepth: 1,
        columnSchemaIds: { '-1': 'service', '1': 'database' }
      }
    });

    expect(graph.columns.find(column => column.index === -1)?.entities).toEqual([
      expect.objectContaining({ entityId: 'left-service' })
    ]);
    expect(graph.columns.find(column => column.index === -1)?.availableSchemaIds).toEqual([
      'service',
      'database'
    ]);
    expect(graph.columns.find(column => column.index === 1)?.entities).toEqual([
      expect.objectContaining({ entityId: 'right-database' })
    ]);
    expect(graph.connectors).toHaveLength(2);
  });

  it('uses schema-filtered entities as the input to later hops', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          outgoing: [
            {
              entityId: 'service',
              publicId: 'SERVICE',
              entitySlug: 'service',
              entityName: 'Service',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            },
            {
              entityId: 'database',
              publicId: 'DATABASE',
              entitySlug: 'database',
              entityName: 'Database',
              entitySchemaId: 'database',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        },
        service: {
          outgoing: [
            {
              entityId: 'service-child',
              publicId: 'SERVICE-CHILD',
              entitySlug: 'service-child',
              entityName: 'Service Child',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        },
        database: {
          outgoing: [
            {
              entityId: 'database-child',
              publicId: 'DATABASE-CHILD',
              entitySlug: 'database-child',
              entityName: 'Database Child',
              entitySchemaId: 'database',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        }
      }),
      config: {
        leftDepth: 0,
        rightDepth: 2,
        columnSchemaIds: { '1': 'service' }
      }
    });

    expect(graph.columns.find(column => column.index === 1)?.entities).toEqual([
      expect.objectContaining({ entityId: 'service' })
    ]);
    expect(graph.columns.find(column => column.index === 2)?.entities).toEqual([
      expect.objectContaining({ entityId: 'service-child' })
    ]);
    expect(graph.columns.find(column => column.index === 2)?.availableSchemaIds).toEqual([
      'service'
    ]);
  });

  it('retains an unreachable schema selection in the column candidates', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          outgoing: [
            {
              entityId: 'service',
              publicId: 'SERVICE',
              entitySlug: 'service',
              entityName: 'Service',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        }
      }),
      config: {
        leftDepth: 0,
        rightDepth: 1,
        columnSchemaIds: { '1': 'database' }
      }
    });

    expect(graph.columns.find(column => column.index === 1)?.entities).toEqual([]);
    expect(graph.columns.find(column => column.index === 1)?.availableSchemaIds).toEqual([
      'service'
    ]);
  });

  it('includes containment relations by default when no field filter is selected', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          incoming: [],
          outgoing: [
            {
              entityId: 'reference-1',
              publicId: 'REF1',
              entitySlug: 'reference-1',
              entityName: 'Reference 1',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            },
            {
              entityId: 'containment-1',
              publicId: 'CONT1',
              entitySlug: 'containment-1',
              entityName: 'Containment 1',
              entitySchemaId: 'service',
              fieldName: 'Parent',
              kind: 'containment'
            }
          ]
        }
      }),
      config: { leftDepth: 1, rightDepth: 1 }
    });

    expect(
      graph.columns.find(column => column.index === 1)?.entities.map(entity => entity.entityId)
    ).toEqual(['reference-1', 'containment-1']);
    expect(graph.connectors).toHaveLength(2);
    expect(graph.connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toEntityId: 'reference-1', kind: 'reference' }),
        expect.objectContaining({ toEntityId: 'containment-1', kind: 'containment' })
      ])
    );
  });

  it('includes incoming containment relations for filtered entities', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('vendor', 'Acme Cloud', 'vendor')],
      relationsMap: relationMap({
        vendor: {
          incoming: [
            {
              entityId: 'contract',
              publicId: 'CON-1',
              entitySlug: 'acme-cloud-contract',
              entityName: 'Acme Cloud Contract',
              entitySchemaId: 'contract',
              fieldName: 'Vendor',
              fieldPredicate: 'provided by',
              kind: 'containment'
            }
          ]
        }
      }),
      config: { leftDepth: 1, rightDepth: 1 }
    });

    expect(graph.columns.find(column => column.index === -1)?.entities).toEqual([
      expect.objectContaining({ entityId: 'contract', schemaId: 'contract' })
    ]);
    expect(graph.connectors).toEqual([
      expect.objectContaining({
        fromEntityId: 'contract',
        toEntityId: 'vendor',
        fieldLabel: 'provided by',
        kind: 'containment'
      })
    ]);
  });

  it('marks entities that appear in multiple columns as duplicates', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          incoming: [
            {
              entityId: 'dup',
              publicId: 'DUP1',
              entitySlug: 'dup',
              entityName: 'Duplicate',
              entitySchemaId: 'service',
              fieldName: 'Used By',
              kind: 'reference'
            }
          ],
          outgoing: [
            {
              entityId: 'dup',
              publicId: 'DUP1',
              entitySlug: 'dup',
              entityName: 'Duplicate',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            }
          ]
        }
      }),
      config: { leftDepth: 1, rightDepth: 1 }
    });

    expect(graph.duplicateIds.has('dup')).toBe(true);
  });
});

describe('parseExploreConfigValue', () => {
  it('returns null for invalid config payloads', () => {
    expect(parseExploreConfigValue('{"leftDepth":"bad"}')).toBeNull();
    expect(parseExploreConfigValue('{')).toBeNull();
  });
});

describe('normalizeExploreConfig', () => {
  it('uses defaults and clamps depth values to non-negative integers', () => {
    expect(normalizeExploreConfig({ leftDepth: -2, rightDepth: 2.9 })).toMatchObject({
      leftDepth: 0,
      rightDepth: 2
    });
  });

  it('keeps valid per-column schema selections and drops the center column', () => {
    expect(
      normalizeExploreConfig({
        columnSchemaIds: { '-1': 'service', '0': 'application', '1': 'database', bad: 'ignored' }
      }).columnSchemaIds
    ).toEqual({ '-1': 'service', '1': 'database' });
  });
});

describe('per-column relation filters', () => {
  const rel = (entityId: string, fieldName: string) => ({
    entityId,
    publicId: entityId.toUpperCase(),
    entitySlug: entityId,
    entityName: entityId,
    entitySchemaId: 'service',
    fieldName,
    kind: 'reference' as const
  });
  const relations = relationMap({
    a: { outgoing: [rel('keep', 'Depends On'), rel('drop', 'Consumes')] },
    keep: { outgoing: [rel('keep-2', 'Depends On'), rel('drop-2', 'Consumes')] }
  });
  const dependsOnKey = buildRelationKey('application', 'service', {
    fieldName: 'Depends On',
    fieldPredicate: undefined
  });

  it('lists the relations leading out of each column, ignoring the next column filter', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relations,
      config: {
        leftDepth: 0,
        rightDepth: 1,
        columnRelationKeys: { '1': [dependsOnKey] }
      }
    });

    expect(graph.columns.find(c => c.index === 1)?.entities.map(e => e.entityId)).toEqual(['keep']);
    // The center column offers both outgoing relations although column 1 is filtered...
    expect(graph.columns.find(c => c.index === 0)?.relationsToRight.map(o => o.fieldLabel)).toEqual(
      ['Consumes', 'Depends On']
    );
    // ...and the outermost column offers the relations that a further column would show.
    expect(graph.columns.find(c => c.index === 1)?.relationsToRight.map(o => o.fieldLabel)).toEqual(
      ['Consumes', 'Depends On']
    );
  });

  it('filters each column independently', () => {
    const consumesKey = buildRelationKey('service', 'service', {
      fieldName: 'Consumes',
      fieldPredicate: undefined
    });
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relations,
      config: {
        leftDepth: 0,
        rightDepth: 2,
        columnRelationKeys: { '1': [dependsOnKey], '2': [consumesKey] }
      }
    });

    expect(graph.columns.find(c => c.index === 1)?.entities.map(e => e.entityId)).toEqual(['keep']);
    expect(graph.columns.find(c => c.index === 2)?.entities.map(e => e.entityId)).toEqual([
      'drop-2'
    ]);
  });
});
