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

const relation = (entityId: string, entitySchemaId: string, fieldName = 'uses') =>
  ({
    entityId,
    publicId: entityId,
    entitySlug: entityId,
    entitySchemaId,
    fieldName,
    kind: 'reference',
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
});
