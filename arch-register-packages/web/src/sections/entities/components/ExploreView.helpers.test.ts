import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityRelationData } from '../../../hooks/useEntities';
import {
  buildDefaultRelationFieldNames,
  buildExploreGraph,
  normalizeExploreConfig,
  parseExploreConfigValue
} from './ExploreView.helpers';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

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
      config: { leftDepth: 1, rightDepth: 1, relationFieldNames: [] }
    });

    expect(graph.columns.find(column => column.index === 0)?.entities.map(entity => entity.entityId)).toEqual(['a', 'b']);
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
      config: { leftDepth: 1, rightDepth: 1, relationFieldNames: [] }
    });

    expect(graph.columns.find(column => column.index === -1)?.entities.map(entity => entity.entityId)).toEqual(['left-1']);
    expect(graph.columns.find(column => column.index === 1)?.entities.map(entity => entity.entityId)).toEqual(['right-1']);
    expect(graph.connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromColumn: -1, fromEntityId: 'left-1', toColumn: 0, toEntityId: 'a' }),
        expect.objectContaining({ fromColumn: 0, fromEntityId: 'a', toColumn: 1, toEntityId: 'right-1' })
      ])
    );
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
      config: { leftDepth: 2, rightDepth: 1, relationFieldNames: [] }
    });

    expect(graph.columns.find(column => column.index === -2)?.entities.map(entity => entity.entityId)).toEqual(['left-2']);
    expect(graph.columns.find(column => column.index === 2)).toBeUndefined();
  });

  it('filters traversal and connectors by relation field name', () => {
    const graph = buildExploreGraph({
      centerEntities: [entity('a', 'App A')],
      relationsMap: relationMap({
        a: {
          incoming: [],
          outgoing: [
            {
              entityId: 'keep-me',
              publicId: 'KEEP1',
              entitySlug: 'keep-me',
              entityName: 'Keep Me',
              entitySchemaId: 'service',
              fieldName: 'Depends On',
              kind: 'reference'
            },
            {
              entityId: 'drop-me',
              publicId: 'DROP1',
              entitySlug: 'drop-me',
              entityName: 'Drop Me',
              entitySchemaId: 'service',
              fieldName: 'Consumes',
              kind: 'reference'
            }
          ]
        }
      }),
      config: { leftDepth: 1, rightDepth: 1, relationFieldNames: ['Depends On'] }
    });

    expect(graph.columns.find(column => column.index === 1)?.entities.map(entity => entity.entityId)).toEqual(['keep-me']);
    expect(graph.connectors).toHaveLength(1);
    expect(graph.connectors[0]).toEqual(
      expect.objectContaining({ fieldName: 'Depends On', toEntityId: 'keep-me' })
    );
  });

  it('excludes containment relations by default when no field filter is selected', () => {
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
      config: { leftDepth: 1, rightDepth: 1, relationFieldNames: [] }
    });

    expect(graph.columns.find(column => column.index === 1)?.entities.map(entity => entity.entityId)).toEqual(['reference-1']);
    expect(graph.connectors).toHaveLength(1);
    expect(graph.connectors[0]).toEqual(
      expect.objectContaining({ toEntityId: 'reference-1', kind: 'reference' })
    );
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
      config: { leftDepth: 1, rightDepth: 1, relationFieldNames: [] }
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
      rightDepth: 2,
      relationFieldNames: []
    });
  });

  it('deduplicates selected relation fields while preserving their order', () => {
    expect(
      normalizeExploreConfig({ relationFieldNames: ['dependsOn', 'ownedBy', 'dependsOn'] })
        .relationFieldNames
    ).toEqual(['dependsOn', 'ownedBy']);
  });
});

describe('buildDefaultRelationFieldNames', () => {
  it('includes reference fields and excludes containment fields', () => {
    const schemas = [
      {
        id: 'application',
        workspace: 'ws',
        name: 'Application',
        description: '',
        key_prefix: 'APP',
        fields: [
          { id: 'dependsOn', name: 'Depends On', type: 'reference', schemaId: 'service', minCount: 0, maxCount: -1, requirementLevel: null },
          { id: 'parent', name: 'Parent', type: 'containment', schemaId: 'application', minCount: 0, maxCount: 1, requirementLevel: null }
        ],
        color: null,
        icon: null,
        entity_count: 0,
        created_at: '',
        updated_at: ''
      }
    ] as EntitySchema[];

    expect(buildDefaultRelationFieldNames(schemas)).toEqual(['Depends On']);
  });
});
