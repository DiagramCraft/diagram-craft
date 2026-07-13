import { ASSESSMENT_FIELD_PREFIX, resolveAssessmentValue } from '@arch-register/api-types/assessmentFilter';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityRelationData } from '../../../hooks/useEntities';
import { getCategoricalValue } from './entityFieldSources';
import type { BrowserEntityRecord } from './entityBrowserState';

export type MatrixAttrField = {
  fieldId: string;
  label: string;
  options: { value: string; label: string }[];
  isMetadata: boolean;
};

export type MatrixColumn = { id: string; publicId: string; label: string };

export type MatrixData = {
  displayRows: EntityRecord[];
  displayCols: MatrixColumn[];
  cellMatrix: boolean[][];
  totalFilled: number;
  rowCounts: number[];
  colCounts: number[];
};

export const autoPickColSchemaId = (
  rows: EntityRecord[],
  relationsMap: Map<string, Pick<EntityRelationData, 'outgoing' | 'incoming'>>,
  rowSchemaIds: Set<string>,
  allSchemaIds: string[]
): string | null => {
  const counts: Record<string, number> = {};
  rows.forEach(row => {
    const rel = relationsMap.get(row._uid);
    if (!rel) return;
    [...rel.outgoing, ...rel.incoming].forEach(relation => {
      if (!rowSchemaIds.has(relation.entitySchemaId)) {
        counts[relation.entitySchemaId] = (counts[relation.entitySchemaId] ?? 0) + 1;
      }
    });
  });

  const candidates = allSchemaIds.filter(id => !rowSchemaIds.has(id) && counts[id]);
  if (candidates.length) {
    return candidates.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0] ?? null;
  }
  return allSchemaIds.find(id => !rowSchemaIds.has(id)) ?? allSchemaIds[0] ?? null;
};

export type BuildMatrixDataArgs = {
  rows: EntityRecord[];
  colMode: 'entity' | 'attribute';
  colEntities: EntityRecord[];
  attrField: MatrixAttrField | null;
  colFieldId: string | null;
  relationsMap: Map<string, Pick<EntityRelationData, 'outgoing' | 'incoming'>>;
  filterFieldName: string | null;
  hideEmptyRows: boolean;
  hideEmptyCols: boolean;
  fullRowsMap: Map<string, EntityRecord>;
};

const emptyMatrixData = (): MatrixData => ({
  displayRows: [],
  displayCols: [],
  cellMatrix: [],
  totalFilled: 0,
  rowCounts: [],
  colCounts: []
});

export const buildMatrixData = ({
  rows,
  colMode,
  colEntities,
  attrField,
  colFieldId,
  relationsMap,
  filterFieldName,
  hideEmptyRows,
  hideEmptyCols,
  fullRowsMap
}: BuildMatrixDataArgs): MatrixData => {
  if (!rows.length) return emptyMatrixData();

  const allCols: MatrixColumn[] =
    colMode === 'entity'
      ? colEntities.map(entity => ({ id: entity._uid, publicId: entity._publicId, label: entity._name }))
      : (attrField?.options ?? []).map(option => ({ id: option.value, publicId: option.value, label: option.label }));
  if (!allCols.length) return emptyMatrixData();

  const full = rows.map(row => {
    const relationData = relationsMap.get(row._uid);
    return allCols.map(column => {
      if (colMode === 'entity') {
        if (!relationData) return false;
        const matchesField = (fieldName: string) => filterFieldName === null || fieldName === filterFieldName;
        return (
          relationData.outgoing.some(relation => relation.entityId === column.id && matchesField(relation.fieldName)) ||
          relationData.incoming.some(relation => relation.entityId === column.id && matchesField(relation.fieldName))
        );
      }

      if (!colFieldId || !attrField) return false;
      let value: unknown;
      if (colFieldId.startsWith(ASSESSMENT_FIELD_PREFIX)) {
        const assessmentValue = resolveAssessmentValue(row as BrowserEntityRecord, colFieldId);
        value = assessmentValue == null ? undefined : String(assessmentValue);
      } else if (attrField.isMetadata) {
        value = getCategoricalValue(row, colFieldId);
      } else {
        value = (fullRowsMap.get(row._uid) ?? row)[colFieldId];
      }
      return Array.isArray(value) ? value.includes(column.id) : value === column.id;
    });
  });

  const rowMask = rows.map((_, rowIndex) => !hideEmptyRows || full[rowIndex]!.some(Boolean));
  const colMask = allCols.map((_, columnIndex) => !hideEmptyCols || rows.some((_, rowIndex) => full[rowIndex]![columnIndex]));
  const rowIndexes = rows.flatMap((_, index) => (rowMask[index] ? [index] : []));
  const colIndexes = allCols.flatMap((_, index) => (colMask[index] ? [index] : []));
  const displayRows = rowIndexes.map(index => rows[index]!);
  const displayCols = colIndexes.map(index => allCols[index]!);
  const cellMatrix = rowIndexes.map(rowIndex => colIndexes.map(columnIndex => full[rowIndex]![columnIndex]!));
  const totalFilled = cellMatrix.flat().filter(Boolean).length;
  const rowCounts = cellMatrix.map(row => row.filter(Boolean).length);
  const colCounts = displayCols.map((_, columnIndex) => cellMatrix.filter(row => row[columnIndex]).length);

  return { displayRows, displayCols, cellMatrix, totalFilled, rowCounts, colCounts };
};
