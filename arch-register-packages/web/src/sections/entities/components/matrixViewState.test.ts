import { describe, expect, it } from 'vitest';
import type { EntityRecord, EntityRelation } from '@arch-register/api-types/entityContract';
import { autoPickColSchemaId, buildMatrixData, type MatrixAttrField } from './matrixViewState';

const entity = (id: string, schemaId = 'service', fields: Record<string, unknown> = {}) =>
  ({
    _uid: id,
    _publicId: id,
    _name: id,
    _slug: id,
    _schema: { id: schemaId, name: schemaId },
    _lifecycle: null,
    _owner: null,
    ...fields
  }) as unknown as EntityRecord;

const relation = (
  entityId: string,
  entitySchemaId: string,
  fieldName = 'uses',
  kind: EntityRelation['kind'] = 'reference'
) =>
  ({
    entityId,
    publicId: entityId,
    entitySlug: entityId,
    entitySchemaId,
    fieldName,
    kind,
    entityName: entityId
  }) as EntityRelation;

describe('matrix view state', () => {
  it('auto-selects the most frequently related schema', () => {
    const rows = [entity('r1'), entity('r2')];
    const relationsMap = new Map([
      ['r1', { outgoing: [relation('a', 'app')], incoming: [relation('b', 'team')] }],
      ['r2', { outgoing: [relation('c', 'app')], incoming: [] }]
    ]);
    expect(
      autoPickColSchemaId(rows, relationsMap, new Set(['service']), ['service', 'app', 'team'])
    ).toBe('app');
  });

  it('builds and filters entity relation cells', () => {
    const rows = [entity('r1'), entity('r2')];
    const cols = [entity('a', 'app'), entity('b', 'app')];
    const relationsMap = new Map([
      ['r1', { outgoing: [relation('a', 'app', 'uses')], incoming: [] }],
      ['r2', { outgoing: [], incoming: [] }]
    ]);
    const data = buildMatrixData({
      rows,
      colMode: 'entity',
      colEntities: cols,
      attrField: null,
      colFieldId: null,
      relationsMap,
      filterFieldName: null,
      hideEmptyRows: true,
      hideEmptyCols: true,
      fullRowsMap: new Map()
    });
    expect(data.displayRows.map(row => row._uid)).toEqual(['r1']);
    expect(data.displayCols.map(column => column.id)).toEqual(['a']);
    expect(data.cellMatrix).toEqual([[true]]);
    expect(data.totalFilled).toBe(1);
  });

  it('reads custom multi-select values from full rows', () => {
    const attrField: MatrixAttrField = {
      fieldId: 'tags',
      label: 'Tags',
      options: [
        { value: 'important', label: 'Important' },
        { value: 'later', label: 'Later' }
      ],
      isMetadata: false
    };
    const summary = entity('r1');
    const full = entity('r1', 'service', { tags: ['important'] });
    const data = buildMatrixData({
      rows: [summary],
      colMode: 'attribute',
      colEntities: [],
      attrField,
      colFieldId: 'tags',
      relationsMap: new Map(),
      filterFieldName: null,
      hideEmptyRows: false,
      hideEmptyCols: false,
      fullRowsMap: new Map([['r1', full]])
    });
    expect(data.cellMatrix).toEqual([[true, false]]);
  });

  it('buckets typed relations the same as reference relations', () => {
    const rows = [entity('r1'), entity('r2')];
    const cols = [entity('a', 'app'), entity('b', 'app')];
    const relationsMap = new Map([
      ['r1', { outgoing: [relation('a', 'app', 'flowsInto', 'typed')], incoming: [] }],
      ['r2', { outgoing: [], incoming: [] }]
    ]);
    const data = buildMatrixData({
      rows,
      colMode: 'entity',
      colEntities: cols,
      attrField: null,
      colFieldId: null,
      relationsMap,
      filterFieldName: 'flowsInto',
      hideEmptyRows: true,
      hideEmptyCols: true,
      fullRowsMap: new Map()
    });
    expect(data.displayRows.map(row => row._uid)).toEqual(['r1']);
    expect(data.displayCols.map(column => column.id)).toEqual(['a']);
    expect(data.cellMatrix).toEqual([[true]]);
  });

  it('colors cells by the weakest value of the typed-relation color field', () => {
    const typed = (entityId: string, effectiveness: string) => ({
      ...relation(entityId, 'risk', 'mitigates', 'typed'),
      relationFields: { effectiveness }
    });
    const rows = [entity('c1'), entity('c2')];
    const cols = [entity('a', 'risk'), entity('b', 'risk')];
    const relationsMap = new Map([
      [
        'c1',
        { outgoing: [typed('a', 'full'), typed('a', 'partial'), typed('b', 'full')], incoming: [] }
      ],
      ['c2', { outgoing: [relation('a', 'risk', 'mitigates', 'typed')], incoming: [] }]
    ]);
    const args = {
      rows,
      colMode: 'entity' as const,
      colEntities: cols,
      attrField: null,
      colFieldId: null,
      relationsMap,
      filterFieldName: null,
      hideEmptyRows: false,
      hideEmptyCols: false,
      fullRowsMap: new Map()
    };
    const colored = buildMatrixData({
      ...args,
      cellColorSource: 'relation',
      cellColorFieldId: 'effectiveness',
      cellColorValueOrder: ['none', 'partial', 'substantial', 'full']
    });
    expect(colored.cellValues).toEqual([
      ['partial', 'full'],
      [null, null]
    ]);
    expect(colored.cellMatrix).toEqual([
      [true, true],
      [true, false]
    ]);
    expect(
      buildMatrixData(args)
        .cellValues.flat()
        .every(v => v === null)
    ).toBe(true);
  });

  it('colors cells by a row or column entity attribute', () => {
    const rows = [
      entity('c1', 'control', { eff: 'good' }),
      entity('c2', 'control', { eff: 'bad' })
    ];
    const cols = [entity('a', 'risk', { sev: 'high' })];
    const relationsMap = new Map([
      ['c1', { outgoing: [relation('a', 'risk')], incoming: [] }],
      ['c2', { outgoing: [], incoming: [] }]
    ]);
    const base = {
      rows,
      colMode: 'entity' as const,
      colEntities: cols,
      attrField: null,
      colFieldId: null,
      relationsMap,
      filterFieldName: null,
      hideEmptyRows: false,
      hideEmptyCols: false,
      fullRowsMap: new Map()
    };
    const byRow = buildMatrixData({
      ...base,
      cellColorSource: 'row',
      cellColorFieldId: 'eff',
      cellColorEntityValue: e => String((e as Record<string, unknown>).eff)
    });
    expect(byRow.cellValues).toEqual([['good'], [null]]);
    const byColumn = buildMatrixData({
      ...base,
      cellColorSource: 'column',
      cellColorFieldId: 'sev',
      cellColorEntityValue: e => String((e as Record<string, unknown>).sev)
    });
    expect(byColumn.cellValues).toEqual([['high'], [null]]);
  });
});
