import { useState, useMemo, useCallback } from 'react';
import styles from './MatrixView.module.css';
import { TbChevronDown, TbRowRemove, TbColumnRemove } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntities, useMultipleEntityRelations } from '../../../hooks/useEntities';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { matrixViewConfigSchema } from '@arch-register/api-types/viewContract';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import {
  getCategoricalFields,
  getCategoricalFieldValues,
  LIFECYCLE_FIELD_ID,
  OWNER_FIELD_ID,
  type JoinedAssessmentContext
} from './entityFieldSources';
import { normalizeViewConfig } from './entityViewConfig';
import { EmptyState } from '../../../components/EmptyState';
import { autoPickColSchemaId, buildMatrixData, type MatrixAttrField } from './matrixViewState';
import { useHydratedEntityRows } from '../../../hooks/useHydratedEntityRows';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatrixConfig = {
  colMode: 'entity' | 'attribute';
  colSchemaId: string | null;
  colEnumFieldId: string | null;
  filterFieldName: string | null;
  hideEmptyRows: boolean;
  hideEmptyCols: boolean;
};

const DEFAULT_MATRIX_CONFIG: MatrixConfig = {
  colMode: 'entity',
  colSchemaId: null,
  colEnumFieldId: null,
  filterFieldName: null,
  hideEmptyRows: false,
  hideEmptyCols: false
};

type MatrixViewProps = EntityBrowserRowViewProps & {
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  config: unknown;
  onConfigChange: (cfg: MatrixConfig) => void;
  hideToolbar?: boolean;
  joinedAssessment?: JoinedAssessmentContext | null;
};

type ColMode = 'entity' | 'attribute';

type RelationFieldOption = {
  value: string;
  label: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────

export const MatrixView = ({
  rows,
  schemaMap,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  hideToolbar,
  joinedAssessment
}: MatrixViewProps) => {
  const { workspaceSlug: workspaceId, schemas, lifecycleStates, teams } = useWorkspaceContext();
  const parsedConfig = useMemo(
    () => normalizeViewConfig(matrixViewConfigSchema, config, DEFAULT_MATRIX_CONFIG),
    [config]
  );

  const [colMode, setColMode] = useState<ColMode>(parsedConfig.colMode);
  const [colSchemaId, setColSchemaId] = useState<string | null>(parsedConfig.colSchemaId);
  const [colEnumFieldId, setColEnumFieldId] = useState<string | null>(parsedConfig.colEnumFieldId);
  const [filterFieldName, setFilterFieldName] = useState<string | null>(
    parsedConfig.filterFieldName
  );
  const [hideEmptyRows, setHideEmptyRows] = useState(parsedConfig.hideEmptyRows);
  const [hideEmptyCols, setHideEmptyCols] = useState(parsedConfig.hideEmptyCols);

  const notifyConfigChange = useCallback(
    (patch: Partial<MatrixConfig>) => {
      onConfigChange({
        colMode,
        colSchemaId,
        colEnumFieldId,
        filterFieldName,
        hideEmptyRows,
        hideEmptyCols,
        ...patch
      });
    },
    [
      onConfigChange,
      colMode,
      colSchemaId,
      colEnumFieldId,
      filterFieldName,
      hideEmptyRows,
      hideEmptyCols
    ]
  );
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  const rowEntityIds = useMemo(() => rows.map(r => r._uid), [rows]);
  const rowSchemaIds = useMemo(() => new Set(rows.map(r => r._schema.id)), [rows]);
  const allSchemaIds = useMemo(() => schemas.map(s => s.id), [schemas]);

  const relationsMap = useMultipleEntityRelations(workspaceId, rowEntityIds);

  const isLoadingRelations = useMemo(
    () => rowEntityIds.some(id => relationsMap.get(id)?.isLoading),
    [rowEntityIds, relationsMap]
  );

  // Fetch full-view entities for each row schema when in attribute mode so
  // custom select field values (absent in summary view) are available.
  const hydratedRows = useHydratedEntityRows(workspaceId, rows, colMode === 'attribute');
  const fullRowsMap = useMemo(
    () => new Map(hydratedRows.map(row => [row._uid, row])),
    [hydratedRows]
  );

  // Auto-pick column schema
  const effColSchemaId = useMemo(() => {
    if (colSchemaId) return colSchemaId;
    return autoPickColSchemaId(rows, relationsMap, rowSchemaIds, allSchemaIds);
  }, [colSchemaId, rows, relationsMap, rowSchemaIds, allSchemaIds]);

  // Fetch all entities of the column type (entity mode)
  const { data: colEntitiesRaw = [] } = useEntities(
    workspaceId,
    colMode === 'entity' && effColSchemaId ? { schemaId: effColSchemaId } : {}
  );

  const rowSchemas = useMemo(
    () =>
      [...rowSchemaIds]
        .map(schemaId => schemaMap.get(schemaId)?.schema)
        .filter((s): s is EntitySchema => !!s),
    [rowSchemaIds, schemaMap]
  );

  // Attribute fields: metadata first, then custom select fields from row schemas, then
  // rating/enum assessment fields - same relative order as before the entityFieldSources.ts
  // migration (getCategoricalFields itself orders select fields before Lifecycle/Owner, so its
  // output is reordered here to put the two metadata fields first).
  const attrFields = useMemo((): MatrixAttrField[] => {
    const fieldOptions = getCategoricalFields(
      rowSchemas,
      lifecycleStates,
      teams,
      joinedAssessment,
      true
    );
    const metadataIds = new Set([LIFECYCLE_FIELD_ID, OWNER_FIELD_ID]);
    const ordered = [
      ...fieldOptions.filter(f => metadataIds.has(f.id)),
      ...fieldOptions.filter(f => !metadataIds.has(f.id))
    ];

    return ordered
      .map(f => ({
        fieldId: f.id,
        label: f.label,
        options: getCategoricalFieldValues(
          rowSchemas,
          f.id,
          lifecycleStates,
          teams,
          joinedAssessment
        ).map(o => ({
          value: o.id,
          label: o.label
        })),
        isMetadata: metadataIds.has(f.id)
      }))
      .filter(f => f.isMetadata || f.options.length > 0);
  }, [lifecycleStates, teams, rowSchemas, joinedAssessment]);

  const effColFieldId = colEnumFieldId ?? attrFields[0]?.fieldId ?? null;
  const effAttrField = attrFields.find(f => f.fieldId === effColFieldId) ?? null;

  // Available field names for entity × entity "via" filtering
  const availableFieldNames = useMemo((): RelationFieldOption[] => {
    if (colMode !== 'entity' || !effColSchemaId) return [];
    const names = new Map<string, string>();
    rows.forEach(row => {
      const rel = relationsMap.get(row._uid);
      if (!rel) return;
      [...rel.outgoing, ...rel.incoming].forEach(r => {
        if (r.entitySchemaId === effColSchemaId) {
          names.set(r.fieldName, getRelationDisplayLabel(r));
        }
      });
    });
    return [...names.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [colMode, rows, relationsMap, effColSchemaId]);

  const handleColSchemaChange = (id: string) => {
    setColSchemaId(id);
    setFilterFieldName(null);
    notifyConfigChange({ colSchemaId: id, filterFieldName: null });
  };

  // ── Matrix computation ─────────────────────────────────────────────────────

  const { displayRows, displayCols, cellMatrix, totalFilled, rowCounts, colCounts } = useMemo(
    () =>
      buildMatrixData({
        rows,
        colMode,
        colEntities: colEntitiesRaw,
        attrField: effAttrField,
        colFieldId: effColFieldId,
        relationsMap,
        filterFieldName,
        hideEmptyRows,
        hideEmptyCols,
        fullRowsMap
      }),
    [
      rows,
      colMode,
      colEntitiesRaw,
      effAttrField,
      effColFieldId,
      relationsMap,
      filterFieldName,
      hideEmptyRows,
      hideEmptyCols,
      fullRowsMap
    ]
  );

  // ── Derived display values ─────────────────────────────────────────────────

  const colSchemaEntry = effColSchemaId ? schemaMap.get(effColSchemaId) : null;
  const colSchemaName = colSchemaEntry?.schema.name ?? '…';

  const pipColor =
    colMode === 'entity' && colSchemaEntry
      ? resolveSchemaColor(colSchemaEntry.schema, colSchemaEntry.index)
      : 'var(--accent-fg)';

  const isEmpty = !displayRows.length || !displayCols.length;
  const noRelations =
    colMode === 'entity' &&
    !isLoadingRelations &&
    !availableFieldNames.length &&
    rows.length > 0 &&
    colEntitiesRaw.length > 0;

  const cornerLabel = [
    'Entities',
    colMode === 'entity' ? colSchemaName : (effAttrField?.label ?? '—')
  ].join(' \\ ');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      {/* Config bar */}
      {!hideToolbar && (
        <div className={styles.config}>
          {/* Rows pill */}
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Rows</span>
            <span className={styles.typeTag}>
              <span>Entities</span>
            </span>
          </div>

          {/* Cols pill */}
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Cols</span>

            <div className={styles.segmented}>
              <button
                type="button"
                className={colMode === 'entity' ? styles.segmentedActive : ''}
                onClick={() => {
                  setColMode('entity');
                  notifyConfigChange({ colMode: 'entity' });
                }}
              >
                Entity
              </button>
              <button
                type="button"
                className={colMode === 'attribute' ? styles.segmentedActive : ''}
                onClick={() => {
                  setColMode('attribute');
                  notifyConfigChange({ colMode: 'attribute' });
                }}
              >
                Attribute
              </button>
            </div>

            {colMode === 'entity' ? (
              <>
                <label className={styles.selectWrap}>
                  <select
                    className={styles.select}
                    value={effColSchemaId ?? ''}
                    onChange={e => handleColSchemaChange(e.target.value)}
                  >
                    {schemas.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <TbChevronDown size={10} />
                </label>

                {availableFieldNames.length > 1 && (
                  <label className={styles.selectWrap}>
                    <span className={styles.selectVia}>via</span>
                    <select
                      className={styles.select}
                      value={filterFieldName ?? 'any'}
                      onChange={e => {
                        const v = e.target.value === 'any' ? null : e.target.value;
                        setFilterFieldName(v);
                        notifyConfigChange({ filterFieldName: v });
                      }}
                    >
                      <option value="any">any relation</option>
                      {availableFieldNames.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <TbChevronDown size={10} />
                  </label>
                )}

                {noRelations && (
                  <span className={styles.noRel}>— no relations between these types</span>
                )}
              </>
            ) : attrFields.length > 0 ? (
              <label className={styles.selectWrap}>
                <select
                  className={styles.select}
                  value={effColFieldId ?? ''}
                  onChange={e => {
                    setColEnumFieldId(e.target.value);
                    notifyConfigChange({ colEnumFieldId: e.target.value });
                  }}
                >
                  {attrFields.map(f => (
                    <option key={f.fieldId} value={f.fieldId}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <TbChevronDown size={10} />
              </label>
            ) : (
              <span className={styles.noRel}>No attributes available</span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {!isEmpty && (
            <span className={styles.stat}>
              {totalFilled} filled&thinsp;·&thinsp;{displayRows.length}&thinsp;×&thinsp;
              {displayCols.length}
            </span>
          )}

          <div style={{ flex: 1 }} />

          <div className={styles.toggles}>
            <button
              type="button"
              data-active={hideEmptyRows ? 'true' : 'false'}
              title="Hide empty rows"
              onClick={() => {
                const next = !hideEmptyRows;
                setHideEmptyRows(next);
                notifyConfigChange({ hideEmptyRows: next });
              }}
            >
              <TbRowRemove size={10} />
            </button>
            <button
              type="button"
              data-active={hideEmptyCols ? 'true' : 'false'}
              title="Hide empty cols"
              onClick={() => {
                const next = !hideEmptyCols;
                setHideEmptyCols(next);
                notifyConfigChange({ hideEmptyCols: next });
              }}
            >
              <TbColumnRemove size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Matrix or empty state */}
      {isEmpty ? (
        <EmptyState
          title={
            colMode === 'entity' && noRelations
              ? 'No relationships between these entity types'
              : isLoadingRelations
                ? 'Loading relationships…'
                : 'Nothing to display'
          }
          subtitle={
            colMode === 'entity'
              ? 'Try a different column type, or turn off sparse filtering.'
              : 'Select an attribute to see value distribution.'
          }
        />
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table} cellSpacing="0" cellPadding="0">
            <thead>
              <tr>
                <th className={styles.corner}>
                  <span className={styles.cornerLabel}>{cornerLabel}</span>
                </th>
                {displayCols.map((col, ci) => (
                  <th
                    key={col.id}
                    className={`${styles.colHead}${hoveredCol === ci ? ` ${styles.colHeadHover}` : ''}`}
                    onMouseEnter={() => setHoveredCol(ci)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className={styles.colLabelWrap}>
                      {colMode === 'entity' ? (
                        <button
                          type="button"
                          className={styles.colLabel}
                          title={col.label}
                          onClick={() => onEntityClick(col.publicId)}
                          style={
                            linkedEntityIds != null && !linkedEntityIdSet.has(col.id)
                              ? { color: 'var(--base-fg-more-dim)' }
                              : undefined
                          }
                        >
                          {col.label}
                        </button>
                      ) : (
                        <span className={styles.colLabel} title={col.label}>
                          {col.label}
                        </span>
                      )}
                    </div>
                    <span className={styles.colCount}>
                      {colCounts[ci]! > 0 ? colCounts[ci] : ''}
                    </span>
                  </th>
                ))}
                <th className={styles.filler} />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, ri) => {
                const rowEntry = schemaMap.get(row._schema.id);
                const rowColor = rowEntry
                  ? resolveSchemaColor(rowEntry.schema, rowEntry.index)
                  : 'var(--accent-fg)';
                return (
                  <tr key={row._uid} className={styles.row}>
                    <td className={styles.rowHead}>
                      <div className={styles.rowHeadInner}>
                        <button
                          type="button"
                          className={styles.rowBtn}
                          onClick={() => onEntityClick(row._publicId)}
                        >
                          <TypeBadge color={rowColor} icon={rowEntry?.schema.icon} size={13} />
                          <span
                            className={styles.rowName}
                            style={
                              linkedEntityIds != null && !linkedEntityIdSet.has(row._uid)
                                ? { color: 'var(--base-fg-more-dim)' }
                                : undefined
                            }
                          >
                            {row._name}
                          </span>
                        </button>
                        <span className={styles.rowCount}>
                          {rowCounts[ri]! > 0 ? rowCounts[ri] : ''}
                        </span>
                      </div>
                    </td>
                    {cellMatrix[ri]!.map((filled, ci) => (
                      <td
                        key={ci}
                        className={`${styles.cell}${filled ? ` ${styles.cellOn}` : ''}${hoveredCol === ci ? ` ${styles.cellColHover}` : ''}`}
                        onMouseEnter={() => setHoveredCol(ci)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        {filled && <span className={styles.pip} style={{ background: pipColor }} />}
                      </td>
                    ))}
                    <td className={styles.filler} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
