import { useState, useMemo, useCallback } from 'react';
import styles from './RelationMatrixView.module.css';
import { TbColumnRemove, TbHelp, TbRowRemove } from 'react-icons/tb';
import { Popover } from '@diagram-craft/app-components/Popover';
import { ToolbarButton } from '../../../components/ToolbarButton';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { TypeBadge } from '../../../components/TypeBadge';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntities, useMultipleEntityRelations } from '../../../hooks/useEntities';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { toneColor } from '../../../components/bandColor';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import { resolveSchemaColor, schemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityRecord, EntityRelation } from '@arch-register/api-types/entityContract';
import { matrixViewConfigSchema } from '@arch-register/api-types/viewContract';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import {
  getCategoricalFields,
  getCategoricalFieldValues,
  getCategoricalValue,
  LIFECYCLE_FIELD_ID,
  OWNER_FIELD_ID,
  type JoinedAssessmentContext
} from './entityFieldSources';
import { normalizeViewConfig } from './entityViewConfig';
import { EmptyState } from '../../../components/EmptyState';
import { autoPickColSchemaId, buildMatrixData, type MatrixAttrField } from './relationMatrixState';
import { useHydratedEntityRows } from '../../../hooks/useHydratedEntityRows';
import { ViewControls, ViewControlsFrame } from '../../../components/ViewControls';

// ── Types ─────────────────────────────────────────────────────────────────────

type ColorSource = 'relation' | 'row' | 'column';
type ColorTone = 'good' | 'warn' | 'bad' | 'neutral';

export type MatrixConfig = {
  colMode: 'entity' | 'attribute';
  colSchemaId: string | null;
  colEnumFieldId: string | null;
  filterFieldName: string | null;
  hideEmptyRows: boolean;
  hideEmptyCols: boolean;
  cellColorSource?: ColorSource | null;
  cellColorFieldId?: string | null;
  cellColorTones?: Record<string, ColorTone>;
};

const DEFAULT_MATRIX_CONFIG: MatrixConfig = {
  colMode: 'entity',
  colSchemaId: null,
  colEnumFieldId: null,
  filterFieldName: null,
  hideEmptyRows: false,
  hideEmptyCols: false,
  cellColorSource: null,
  cellColorFieldId: null
};

type RelationMatrixViewProps = EntityBrowserRowViewProps & {
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  config: unknown;
  onConfigChange: (cfg: MatrixConfig) => void;
  hideToolbar?: boolean;
  joinedAssessment?: JoinedAssessmentContext | null;
};

type ColMode = 'entity' | 'attribute';

type ColorFieldOption = {
  /** `${source}:${fieldId}`, the value of the "color by" select. */
  key: string;
  source: ColorSource;
  fieldId: string;
  label: string;
  options: { value: string; label: string }[];
};

const COLOR_SOURCE_LABEL: Record<ColorSource, string> = {
  relation: 'relation',
  row: 'row',
  column: 'column'
};

type RelationFieldOption = {
  value: string;
  label: string;
  kind: EntityRelation['kind'];
  color?: string | null;
  icon?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────

export const RelationMatrixView = ({
  rows,
  schemaMap,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  hideToolbar,
  joinedAssessment
}: RelationMatrixViewProps) => {
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
  const [cellColorFieldId, setCellColorFieldId] = useState<string | null>(
    parsedConfig.cellColorFieldId ?? null
  );
  const [cellColorSource, setCellColorSource] = useState<ColorSource | null>(
    parsedConfig.cellColorSource ?? (parsedConfig.cellColorFieldId ? 'relation' : null)
  );
  const cellColorTones = parsedConfig.cellColorTones;

  const notifyConfigChange = useCallback(
    (patch: Partial<MatrixConfig>) => {
      onConfigChange({
        colMode,
        colSchemaId,
        colEnumFieldId,
        filterFieldName,
        hideEmptyRows,
        hideEmptyCols,
        cellColorSource,
        cellColorFieldId,
        cellColorTones,
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
      hideEmptyCols,
      cellColorSource,
      cellColorFieldId,
      cellColorTones
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
  const hydratedRows = useHydratedEntityRows(
    workspaceId,
    rows,
    colMode === 'attribute' || cellColorSource === 'row'
  );
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

  const colEntities = useHydratedEntityRows(
    workspaceId,
    colEntitiesRaw,
    colMode === 'entity' && cellColorSource === 'column'
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
    const options = new Map<string, RelationFieldOption>();
    rows.forEach(row => {
      const rel = relationsMap.get(row._uid);
      if (!rel) return;
      [...rel.outgoing, ...rel.incoming].forEach(r => {
        if (r.entitySchemaId === effColSchemaId && !options.has(r.fieldName)) {
          options.set(r.fieldName, {
            value: r.fieldName,
            label: getRelationDisplayLabel(r),
            kind: r.kind,
            color: r.relationSchemaColor,
            icon: r.relationSchemaIcon
          });
        }
      });
    });
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [colMode, rows, relationsMap, effColSchemaId]);

  // Select fields that can color a cell: those of the typed relations seen between the row and
  // column entities, of the row entities, and of the column entities.
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId);
  const colorFields = useMemo((): ColorFieldOption[] => {
    if (colMode !== 'entity' || !effColSchemaId) return [];
    const result: ColorFieldOption[] = [];

    const entityFields = (source: 'row' | 'column', schemasOfSide: EntitySchema[]) =>
      getCategoricalFields(schemasOfSide, lifecycleStates, teams).forEach(field => {
        const options = getCategoricalFieldValues(
          schemasOfSide,
          field.id,
          lifecycleStates,
          teams
        ).map(o => ({ value: o.id, label: o.label }));
        if (options.length === 0) return;
        result.push({
          key: `${source}:${field.id}`,
          source,
          fieldId: field.id,
          label: field.label,
          options
        });
      });
    entityFields('row', rowSchemas);
    const colSchema = schemaMap.get(effColSchemaId)?.schema;
    if (colSchema) entityFields('column', [colSchema]);

    const seenSchemaIds = new Set<string>();
    rows.forEach(row => {
      const rel = relationsMap.get(row._uid);
      [...(rel?.outgoing ?? []), ...(rel?.incoming ?? [])].forEach(r => {
        if (r.kind === 'typed' && r.relationSchemaId && r.entitySchemaId === effColSchemaId) {
          seenSchemaIds.add(r.relationSchemaId);
        }
      });
    });
    relationSchemas
      .filter(schema => seenSchemaIds.has(schema.id))
      .forEach(schema =>
        schema.fields.forEach(field => {
          const key = `relation:${field.id}`;
          if (field.type !== 'select' || result.some(f => f.key === key)) return;
          result.push({
            key,
            source: 'relation',
            fieldId: field.id,
            label: field.name,
            options: (field.options ?? []).filter(o => !o.retired)
          });
        })
      );
    return result;
  }, [
    colMode,
    effColSchemaId,
    rows,
    rowSchemas,
    schemaMap,
    relationsMap,
    relationSchemas,
    lifecycleStates,
    teams
  ]);

  const effColorField =
    colorFields.find(f => f.source === cellColorSource && f.fieldId === cellColorFieldId) ?? null;
  const cellColorEntityValue = useMemo(() => {
    const fieldId = effColorField?.fieldId;
    if (!fieldId || effColorField.source === 'relation') return undefined;
    return (entity: EntityRecord): string | null => getCategoricalValue(entity, fieldId);
  }, [effColorField]);
  // Semantic tones (from config) win; other options use a categorical palette. The legend shows
  // exactly these colors.
  const valueColors = useMemo(() => {
    const map = new Map<string, string>();
    effColorField?.options.forEach((o, i) => {
      const tone = cellColorTones?.[o.value];
      map.set(o.value, tone ? toneColor(tone) : schemaColor(i));
    });
    return map;
  }, [effColorField, cellColorTones]);

  const handleColSchemaChange = (id: string) => {
    setColSchemaId(id);
    setFilterFieldName(null);
    setCellColorSource(null);
    setCellColorFieldId(null);
    notifyConfigChange({
      colSchemaId: id,
      filterFieldName: null,
      cellColorSource: null,
      cellColorFieldId: null
    });
  };

  // ── Matrix computation ─────────────────────────────────────────────────────

  const { displayRows, displayCols, cellMatrix, cellValues, rowCounts, colCounts } = useMemo(
    () =>
      buildMatrixData({
        rows,
        colMode,
        colEntities,
        attrField: effAttrField,
        colFieldId: effColFieldId,
        relationsMap,
        filterFieldName,
        hideEmptyRows,
        hideEmptyCols,
        fullRowsMap,
        cellColorSource: effColorField?.source ?? null,
        cellColorFieldId: effColorField?.fieldId ?? null,
        cellColorEntityValue,
        cellColorValueOrder: effColorField?.options.map(o => o.value) ?? []
      }),
    [
      rows,
      colMode,
      colEntities,
      effAttrField,
      effColFieldId,
      relationsMap,
      filterFieldName,
      hideEmptyRows,
      hideEmptyCols,
      fullRowsMap,
      effColorField,
      cellColorEntityValue
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
    <ViewControlsFrame>
      {/* Config bar */}
      {!hideToolbar && (
        <ViewControls variant="view">
          <LabeledSelect
            label="Columns"
            value={colMode}
            onChange={value => {
              const next = value as 'entity' | 'attribute';
              setColMode(next);
              notifyConfigChange({ colMode: next });
            }}
            options={[
              { value: 'entity', label: 'Entity' },
              { value: 'attribute', label: 'Attribute' }
            ]}
          />

          {colMode === 'entity' ? (
            <>
              <LabeledSelect
                label="Type"
                value={effColSchemaId ?? ''}
                onChange={handleColSchemaChange}
                options={schemas.map(s => ({ value: s.id, label: s.name }))}
              />

              {availableFieldNames.length > 1 && (
                <LabeledSelect
                  label="Via"
                  value={filterFieldName ?? 'any'}
                  onChange={value => {
                    const v = value === 'any' ? null : value;
                    setFilterFieldName(v);
                    notifyConfigChange({ filterFieldName: v });
                  }}
                  options={[
                    { value: 'any', label: 'Any relation' },
                    ...availableFieldNames.map(option => ({
                      value: option.value,
                      label: `${option.label}${option.kind === 'typed' ? ' (typed relation)' : ''}`
                    }))
                  ]}
                />
              )}

              {colorFields.length > 0 && (
                <LabeledSelect
                  label="Color"
                  value={effColorField?.key ?? 'none'}
                  onChange={value => {
                    const field = colorFields.find(f => f.key === value) ?? null;
                    setCellColorSource(field?.source ?? null);
                    setCellColorFieldId(field?.fieldId ?? null);
                    notifyConfigChange({
                      cellColorSource: field?.source ?? null,
                      cellColorFieldId: field?.fieldId ?? null
                    });
                  }}
                  options={[
                    { value: 'none', label: 'None' },
                    ...colorFields.map(f => ({
                      value: f.key,
                      label: `${f.label} (${COLOR_SOURCE_LABEL[f.source]})`
                    }))
                  ]}
                />
              )}

              {effColorField && !isEmpty && (
                <Popover.Root>
                  <Popover.Trigger
                    element={
                      <ToolbarButton
                        icon={<TbHelp size={13} />}
                        title="Show color legend"
                        aria-label="Show color legend"
                      />
                    }
                  />
                  <Popover.Content
                    side="bottom"
                    sideOffset={4}
                    align="start"
                    arrow={false}
                    closeButton={false}
                    className={styles.legendPopover}
                  >
                    <div className={styles.legendTitle}>{effColorField.label}</div>
                    {effColorField.options.map(o => (
                      <div key={o.value} className={styles.legendItem}>
                        <span
                          className={styles.pip}
                          style={{ background: valueColors.get(o.value) }}
                        />
                        {o.label}
                      </div>
                    ))}
                  </Popover.Content>
                </Popover.Root>
              )}

              {noRelations && (
                <span className={styles.noRel}>— no relations between these types</span>
              )}
            </>
          ) : attrFields.length > 0 ? (
            <LabeledSelect
              label="Attribute"
              value={effColFieldId ?? ''}
              onChange={value => {
                setColEnumFieldId(value);
                notifyConfigChange({ colEnumFieldId: value });
              }}
              options={attrFields.map(f => ({ value: f.fieldId, label: f.label }))}
            />
          ) : (
            <span className={styles.noRel}>No attributes available</span>
          )}

          <ToolbarButton
            variant={hideEmptyRows ? 'primary' : 'secondary'}
            icon={<TbRowRemove size={13} />}
            title={hideEmptyRows ? 'Show empty rows' : 'Hide empty rows'}
            aria-label={hideEmptyRows ? 'Show empty rows' : 'Hide empty rows'}
            aria-pressed={hideEmptyRows}
            onClick={() => {
              const next = !hideEmptyRows;
              setHideEmptyRows(next);
              notifyConfigChange({ hideEmptyRows: next });
            }}
          />
          <ToolbarButton
            variant={hideEmptyCols ? 'primary' : 'secondary'}
            icon={<TbColumnRemove size={13} />}
            title={hideEmptyCols ? 'Show empty columns' : 'Hide empty columns'}
            aria-label={hideEmptyCols ? 'Show empty columns' : 'Hide empty columns'}
            aria-pressed={hideEmptyCols}
            onClick={() => {
              const next = !hideEmptyCols;
              setHideEmptyCols(next);
              notifyConfigChange({ hideEmptyCols: next });
            }}
          />
        </ViewControls>
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
                    {cellMatrix[ri]!.map((filled, ci) => {
                      const value = cellValues[ri]![ci] ?? null;
                      const color =
                        (value != null ? valueColors.get(value) : undefined) ??
                        (effColorField ? toneColor('neutral') : pipColor);
                      return (
                        <td
                          key={ci}
                          className={`${styles.cell}${filled ? ` ${styles.cellOn}` : ''}${hoveredCol === ci ? ` ${styles.cellColHover}` : ''}`}
                          onMouseEnter={() => setHoveredCol(ci)}
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          {filled && (
                            <span
                              className={styles.pip}
                              style={{ background: color }}
                              title={
                                effColorField
                                  ? `${effColorField.label}: ${
                                      value != null
                                        ? (effColorField.options.find(o => o.value === value)
                                            ?.label ?? value)
                                        : 'No value'
                                    }`
                                  : undefined
                              }
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className={styles.filler} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ViewControlsFrame>
  );
};
