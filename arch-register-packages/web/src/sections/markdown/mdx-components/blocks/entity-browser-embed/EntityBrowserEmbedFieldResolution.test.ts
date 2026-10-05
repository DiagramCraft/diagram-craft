import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  resolveMatrixViewConfig,
  resolveEntityQuery,
  resolveSort,
  resolveTableFieldIds
} from './EntityBrowserEmbedFieldResolution';

const rootSchema: EntitySchema = {
  id: 'schema-term-real-id',
  name: 'Term',
  fields: [
    {
      id: 'field-categories-real-id',
      name: 'Categories',
      type: 'reference',
      requirementLevel: 'optional'
    },
    { id: 'field-status-real-id', name: 'Status', type: 'select', requirementLevel: 'optional' }
  ]
} as unknown as EntitySchema;

describe('resolveTableFieldIds', () => {
  it('resolves schema field names, leaves standard fields and unresolved names untouched', () => {
    const resolved = resolveTableFieldIds(
      { fieldIds: ['_owner', 'Categories', 'Missing Field'] },
      rootSchema
    );
    expect(resolved).toEqual({
      fieldIds: ['_owner', 'field-categories-real-id', 'Missing Field']
    });
  });

  it('passes through unchanged when there is no root schema', () => {
    const config = { fieldIds: ['Categories'] };
    expect(resolveTableFieldIds(config, undefined)).toBe(config);
  });

  it('passes through a config with no fieldIds array', () => {
    const config = { xAxis: 'impact' };
    expect(resolveTableFieldIds(config, rootSchema)).toBe(config);
  });
});

describe('resolveEntityQuery', () => {
  it('resolves a relationExists path, a predicate fieldId, and a projection, and pins schemaId', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'relationExists', path: [{ kind: 'forward', fieldId: 'Categories' }] },
          { kind: 'predicate', path: [], fieldId: '_owner', op: 'in', value: ['$ownerIds'] },
          { kind: 'predicate', path: [], fieldId: 'Status', op: 'equals', value: 'active' }
        ]
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'Categories' }],
          fieldId: '_name',
          alias: 'Category'
        }
      ]
    };

    const resolved = resolveEntityQuery(query, rootSchema, 'schema-term-real-id');

    expect(resolved).toEqual({
      schemaId: 'schema-term-real-id',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'relationExists',
            path: [{ kind: 'forward', fieldId: 'field-categories-real-id' }]
          },
          { kind: 'predicate', path: [], fieldId: '_owner', op: 'in', value: ['$ownerIds'] },
          {
            kind: 'predicate',
            path: [],
            fieldId: 'field-status-real-id',
            op: 'equals',
            value: 'active'
          }
        ]
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'field-categories-real-id' }],
          fieldId: '_name',
          alias: 'Category'
        }
      ]
    });
  });

  it('recurses through or/not nodes', () => {
    const query: EntityQuery = {
      root: {
        kind: 'not',
        child: {
          kind: 'or',
          children: [{ kind: 'predicate', path: [], fieldId: 'Status', op: 'equals', value: 'a' }]
        }
      }
    };

    const resolved = resolveEntityQuery(query, rootSchema, null);

    expect(resolved.root).toEqual({
      kind: 'not',
      child: {
        kind: 'or',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: 'field-status-real-id',
            op: 'equals',
            value: 'a'
          }
        ]
      }
    });
  });

  it('leaves an unresolvable name and a freeText node untouched', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: 'Nonexistent', op: 'equals', value: 'x' },
          { kind: 'freeText', value: 'search text' }
        ]
      }
    };

    const resolved = resolveEntityQuery(query, rootSchema, null);

    expect(resolved.root).toEqual({
      kind: 'and',
      children: [
        { kind: 'predicate', path: [], fieldId: 'Nonexistent', op: 'equals', value: 'x' },
        { kind: 'freeText', value: 'search text' }
      ]
    });
  });

  it('passes through unchanged when there is no root schema', () => {
    const query: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: 'Status', op: 'equals', value: 'a' }
    };
    expect(resolveEntityQuery(query, undefined, null)).toBe(query);
  });
});

describe('resolveEntityQuery with typed relations', () => {
  const dataEntity = {
    id: 'schema-de',
    name: 'Data Entity',
    fields: [
      {
        id: 'f-retention',
        name: 'Retention Policy',
        type: 'typedRelation',
        relationSchemaId: 'rel-assign',
        direction: 'in',
        minCount: 0,
        maxCount: 1,
        requirementLevel: 'optional'
      }
    ]
  } as unknown as EntitySchema;
  const policy = {
    id: 'schema-policy',
    name: 'Retention Policy',
    fields: [{ id: 'f-duration', name: 'Duration', type: 'number' }]
  } as unknown as EntitySchema;
  const assignment = {
    id: 'rel-assign',
    in: { schemaIds: ['schema-de'] },
    out: { schemaIds: ['schema-policy'] },
    fields: [{ id: 'f-activated', name: 'Activated From', type: 'date' }]
  } as unknown as RelationSchema;
  const context = { schemas: [dataEntity, policy], relationSchemas: [assignment] };
  const hop = { kind: 'forward' as const, fieldId: 'Retention Policy' };
  const resolvedHop = {
    kind: 'typedRelation',
    fieldId: 'f-retention',
    relationSchemaId: 'rel-assign',
    direction: 'in',
    ownerSchemaIds: ['schema-de']
  };

  it('upgrades a forward hop naming a typedRelation field and keeps its filter', () => {
    const filter = {
      kind: 'predicate' as const,
      path: [],
      fieldId: '_id',
      op: 'in' as const,
      value: ['x']
    };
    const resolved = resolveEntityQuery(
      { root: { kind: 'relationExists', path: [{ ...hop, filter }] } },
      dataEntity,
      'schema-de',
      context
    );
    expect(resolved.root).toEqual({
      kind: 'relationExists',
      path: [{ ...resolvedHop, filter }]
    });
  });

  it('resolves projection terminal names against the neighbour schema and the relation schema', () => {
    const resolved = resolveEntityQuery(
      {
        root: { kind: 'and', children: [] },
        projections: [
          { path: [hop], fieldId: 'Duration', alias: 'Duration' },
          { path: [hop], fieldId: 'Activated From', source: 'relation', alias: 'Activated' },
          { path: [hop], fieldId: '_name', alias: 'Policy' }
        ]
      },
      dataEntity,
      'schema-de',
      context
    );
    expect(resolved.projections).toEqual([
      { path: [resolvedHop], fieldId: 'f-duration', alias: 'Duration' },
      { path: [resolvedHop], fieldId: 'f-activated', source: 'relation', alias: 'Activated' },
      { path: [resolvedHop], fieldId: '_name', alias: 'Policy' }
    ]);
  });

  it('leaves unknown terminal names unchanged', () => {
    const resolved = resolveEntityQuery(
      { root: { kind: 'and', children: [] }, projections: [{ path: [hop], fieldId: 'Nope' }] },
      dataEntity,
      'schema-de',
      context
    );
    expect(resolved.projections?.[0]).toMatchObject({ fieldId: 'Nope' });
  });

  it('turns a path predicate whose $variable placeholder was never substituted into relationExists', () => {
    const resolved = resolveEntityQuery(
      {
        root: { kind: 'predicate', path: [hop], fieldId: '_id', op: 'in', value: ['$policyId'] }
      },
      dataEntity,
      'schema-de',
      context
    );
    expect(resolved.root).toEqual({ kind: 'relationExists', path: [resolvedHop] });
  });

  it('keeps a path predicate once its placeholder is substituted', () => {
    const resolved = resolveEntityQuery(
      { root: { kind: 'predicate', path: [hop], fieldId: '_id', op: 'in', value: ['abc'] } },
      dataEntity,
      'schema-de',
      context
    );
    expect(resolved.root).toEqual({
      kind: 'predicate',
      path: [resolvedHop],
      fieldId: '_id',
      op: 'in',
      value: ['abc']
    });
  });
});

describe('resolveSort', () => {
  it('resolves a field name in a field sort to the live field id', () => {
    expect(resolveSort('field:Categories:desc', rootSchema)).toBe(
      'field:field-categories-real-id:desc'
    );
  });

  it('passes through other sorts, standard fields and unknown names', () => {
    expect(resolveSort('name', rootSchema)).toBe('name');
    expect(resolveSort('field:_owner:asc', rootSchema)).toBe('field:_owner:asc');
    expect(resolveSort('field:Unknown:asc', rootSchema)).toBe('field:Unknown:asc');
    expect(resolveSort('field:Categories:asc', undefined)).toBe('field:Categories:asc');
  });
});

describe('resolveMatrixViewConfig', () => {
  const risk = { id: 'uuid-1', name: 'Risk', fields: [{ id: 'f-sev', name: 'Severity' }] };
  const control = {
    id: 'uuid-2',
    name: 'Control',
    fields: [{ id: 'f-eff', name: 'Effectiveness' }]
  };
  const schemas = [risk, control] as unknown as EntitySchema[];
  const rootSchema = control as unknown as EntitySchema;

  it('resolves a schema name to its id', () => {
    expect(
      resolveMatrixViewConfig({ colSchemaId: 'Risk', colMode: 'entity' }, schemas, rootSchema)
    ).toEqual({ colSchemaId: 'uuid-1', colMode: 'entity' });
  });

  it('resolves a row or column color field name against the matching schema', () => {
    expect(
      resolveMatrixViewConfig(
        { colSchemaId: 'Risk', cellColorSource: 'row', cellColorFieldId: 'Effectiveness' },
        schemas,
        rootSchema
      )
    ).toMatchObject({ cellColorFieldId: 'f-eff' });
    expect(
      resolveMatrixViewConfig(
        { colSchemaId: 'Risk', cellColorSource: 'column', cellColorFieldId: 'Severity' },
        schemas,
        rootSchema
      )
    ).toMatchObject({ cellColorFieldId: 'f-sev' });
  });

  it('leaves relation color fields, real ids, null and unknown names alone', () => {
    const relation = { colSchemaId: 'uuid-1', cellColorSource: 'relation', cellColorFieldId: 'x' };
    expect(resolveMatrixViewConfig(relation, schemas, rootSchema)).toEqual(relation);
    for (const colSchemaId of [null, 'Nope']) {
      expect(resolveMatrixViewConfig({ colSchemaId }, schemas, rootSchema)).toEqual({
        colSchemaId
      });
    }
  });
});

describe('resolveEntityQuery aggregate projections', () => {
  it('resolves an unboundTypedRelation relation schema name to its id', () => {
    const rootSchema = { id: 'asset', name: 'Data Entity', fields: [] } as unknown as EntitySchema;
    const relationSchemas = [
      { id: 'rel-1', name: 'Control Protection' }
    ] as unknown as RelationSchema[];
    const query = {
      root: { kind: 'and', children: [] },
      projections: [
        {
          kind: 'aggregate',
          path: [
            {
              kind: 'unboundTypedRelation',
              relationSchemaId: 'Control Protection',
              direction: 'both'
            }
          ],
          reducer: 'countDistinct',
          terminal: 'entity',
          alias: 'Controls'
        }
      ]
    } as unknown as EntityQuery;
    const resolved = resolveEntityQuery(query, rootSchema, 'asset', {
      schemas: [rootSchema],
      relationSchemas
    });
    expect(resolved.projections?.[0]?.path[0]).toMatchObject({ relationSchemaId: 'rel-1' });
  });
});
