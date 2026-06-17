import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import styles from './MatrixView.module.css';
import { TbChevronDown, TbRowRemove, TbColumnRemove } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntities, useMultipleEntityRelations } from '../../../hooks/useEntities';
import { entityKeys } from '../../../hooks/queryKeys';
import { orpcClient } from '../../../lib/orpcClient';
import { resolveSchemaColor } from '../../../lib/api';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

// ── Types ─────────────────────────────────────────────────────────────────────

type MatrixViewProps = {
  rows: EntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
};

type ColMode = 'entity' | 'attribute';

type AttrField = {
  fieldId: string;
  label: string;
  options: { value: string; label: string }[];
  isMetadata: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFECYCLE_FIELD_ID = '_lifecycle';
const OWNER_FIELD_ID = '_owner';

// ── Helpers ───────────────────────────────────────────────────────────────────

const autoPickColSchemaId = (
  rows: EntityRecord[],
  relationsMap: Map<
    string,
    { outgoing: { entitySchemaId: string }[]; incoming: { entitySchemaId: string }[] }
  >,
  rowSchemaIds: Set<string>,
  allSchemaIds: string[]
): string | null => {
  const counts: Record<string, number> = {};
  rows.forEach(row => {
    const rel = relationsMap.get(row._uid);
    if (!rel) return;
    [...rel.outgoing, ...rel.incoming].forEach(r => {
      if (!rowSchemaIds.has(r.entitySchemaId)) {
        counts[r.entitySchemaId] = (counts[r.entitySchemaId] ?? 0) + 1;
      }
    });
  });

  const candidates = allSchemaIds.filter(id => !rowSchemaIds.has(id) && counts[id]);
  if (candidates.length) {
    return candidates.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0] ?? null;
  }
  const fallback = allSchemaIds.find(id => !rowSchemaIds.has(id));
  return fallback ?? allSchemaIds[0] ?? null;
};

const getMetadataValue = (row: EntityRecord, fieldId: string): string | null => {
  if (fieldId === LIFECYCLE_FIELD_ID) return row._lifecycle?.id ?? null;
  if (fieldId === OWNER_FIELD_ID) return row._owner?.id ?? null;
  return null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const MatrixView = ({ rows, schemaMap, onEntityClick }: MatrixViewProps) => {
  const {
    workspaceSlug: workspaceId,
    schemas,
    enums,
    lifecycleStates,
    teams
  } = useWorkspaceContext();

  const [colMode, setColMode] = useState<ColMode>('entity');
  const [colSchemaId, setColSchemaId] = useState<string | null>(null);
  const [colEnumFieldId, setColEnumFieldId] = useState<string | null>(null);
  const [filterFieldName, setFilterFieldName] = useState<string | null>(null);
  const [hideEmptyRows, setHideEmptyRows] = useState(false);
  const [hideEmptyCols, setHideEmptyCols] = useState(false);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const rowEntityIds = useMemo(() => rows.map(r => r._uid), [rows]);
  const rowSchemaIds = useMemo(() => new Set(rows.map(r => r._schema.id)), [rows]);
  const allSchemaIds = useMemo(() => schemas.map(s => s.id), [schemas]);
  const rowSchemaIdsArray = useMemo(() => [...rowSchemaIds], [rowSchemaIds]);

  const relationsMap = useMultipleEntityRelations(workspaceId, rowEntityIds);

  const isLoadingRelations = useMemo(
    () => rowEntityIds.some(id => relationsMap.get(id)?.isLoading),
    [rowEntityIds, relationsMap]
  );

  // Fetch full-view entities for each row schema when in attribute mode so
  // custom select field values (absent in summary view) are available.
  const fullEntityResults = useQueries({
    queries: rowSchemaIdsArray.map(schemaId => ({
      queryKey: entityKeys.list(workspaceId, { schemaId, view: 'full' }),
      queryFn: () =>
        orpcClient.entities.list({
          params: { workspace: workspaceId },
          query: { _schemaId: schemaId, view: 'full' }
        }),
      enabled: colMode === 'attribute' && !!workspaceId
    }))
  });

  // Map from uid → full-view EntityRecord (only for entities in current rows)
  const fullRowsMap = useMemo(() => {
    const rowUids = new Set(rows.map(r => r._uid));
    const m = new Map<string, EntityRecord>();
    fullEntityResults.forEach(result => {
      result.data?.forEach(e => {
        if (rowUids.has(e._uid)) m.set(e._uid, e);
      });
    });
    return m;
  }, [fullEntityResults, rows]);

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

  // Attribute fields: metadata first, then custom select fields from row schemas
  const attrFields = useMemo((): AttrField[] => {
    const out: AttrField[] = [];

    if (lifecycleStates.length > 0) {
      out.push({
        fieldId: LIFECYCLE_FIELD_ID,
        label: 'Lifecycle',
        options: [...lifecycleStates]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(s => ({ value: s.id, label: s.label })),
        isMetadata: true
      });
    }

    if (teams.length > 0) {
      out.push({
        fieldId: OWNER_FIELD_ID,
        label: 'Owner',
        options: [...teams]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(t => ({ value: t.id, label: t.name })),
        isMetadata: true
      });
    }

    const seen = new Set<string>();
    rowSchemaIds.forEach(schemaId => {
      const entry = schemaMap.get(schemaId);
      if (!entry) return;
      entry.schema.fields.forEach(f => {
        if (f.type === 'select' && !seen.has(f.id)) {
          seen.add(f.id);
          const enumDef = enums.find(e => e.id === f.enumId);
          const options =
            enumDef?.options ??
            ('options' in f ? (f as { options: { value: string; label: string }[] }).options : []);
          if (options.length > 0) {
            out.push({ fieldId: f.id, label: f.name, options, isMetadata: false });
          }
        }
      });
    });

    return out;
  }, [lifecycleStates, teams, rowSchemaIds, schemaMap, enums]);

  const effColFieldId = colEnumFieldId ?? attrFields[0]?.fieldId ?? null;
  const effAttrField = attrFields.find(f => f.fieldId === effColFieldId) ?? null;

  // Available field names for entity × entity "via" filtering
  const availableFieldNames = useMemo(() => {
    if (colMode !== 'entity' || !effColSchemaId) return [];
    const names = new Set<string>();
    rows.forEach(row => {
      const rel = relationsMap.get(row._uid);
      if (!rel) return;
      [...rel.outgoing, ...rel.incoming].forEach(r => {
        if (r.entitySchemaId === effColSchemaId) names.add(r.fieldName);
      });
    });
    return [...names].sort();
  }, [colMode, rows, relationsMap, effColSchemaId]);

  const handleColSchemaChange = (id: string) => {
    setColSchemaId(id);
    setFilterFieldName(null);
  };

  // ── Matrix computation ─────────────────────────────────────────────────────

  const { displayRows, displayCols, cellMatrix, totalFilled, rowCounts, colCounts } =
    useMemo(() => {
      if (!rows.length)
        return {
          displayRows: [],
          displayCols: [] as { id: string; label: string }[],
          cellMatrix: [] as boolean[][],
          totalFilled: 0,
          rowCounts: [] as number[],
          colCounts: [] as number[]
        };

      let allCols: { id: string; label: string }[];
      if (colMode === 'entity') {
        allCols = colEntitiesRaw.map(e => ({ id: e._uid, label: e._name }));
      } else {
        allCols = (effAttrField?.options ?? []).map(o => ({ id: o.value, label: o.label }));
      }

      if (!allCols.length)
        return {
          displayRows: [],
          displayCols: [],
          cellMatrix: [],
          totalFilled: 0,
          rowCounts: [],
          colCounts: []
        };

      const full = rows.map(row => {
        const rel = relationsMap.get(row._uid);
        return allCols.map(col => {
          if (colMode === 'entity') {
            if (!rel) return false;
            const matchesField = (fieldName: string) =>
              filterFieldName === null || fieldName === filterFieldName;
            return (
              rel.outgoing.some(r => r.entityId === col.id && matchesField(r.fieldName)) ||
              rel.incoming.some(r => r.entityId === col.id && matchesField(r.fieldName))
            );
          } else {
            if (!effColFieldId || !effAttrField) return false;
            let val: unknown;
            if (effAttrField.isMetadata) {
              val = getMetadataValue(row, effColFieldId);
            } else {
              // Use full-view entity if available for custom select fields
              const fullRow = fullRowsMap.get(row._uid) ?? row;
              val = fullRow[effColFieldId];
            }
            return Array.isArray(val) ? val.includes(col.id) : val === col.id;
          }
        });
      });

      const rMask = rows.map((_, ri) => !hideEmptyRows || full[ri]!.some(Boolean));
      const cMask = allCols.map((_, ci) => !hideEmptyCols || rows.some((_, ri) => full[ri]![ci]));

      const rIdx = rows.flatMap((_, i) => (rMask[i] ? [i] : []));
      const cIdx = allCols.flatMap((_, i) => (cMask[i] ? [i] : []));

      const displayRows = rIdx.map(i => rows[i]!);
      const displayCols = cIdx.map(i => allCols[i]!);
      const cellMatrix = rIdx.map(ri => cIdx.map(ci => full[ri]![ci]!));
      const totalFilled = cellMatrix.flat().filter(Boolean).length;
      const rowCounts = cellMatrix.map(row => row.filter(Boolean).length);
      const colCounts = displayCols.map((_, ci) => cellMatrix.filter(row => row[ci]).length);

      return { displayRows, displayCols, cellMatrix, totalFilled, rowCounts, colCounts };
    }, [
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
    ]);

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
              onClick={() => setColMode('entity')}
            >
              Entity
            </button>
            <button
              type="button"
              className={colMode === 'attribute' ? styles.segmentedActive : ''}
              onClick={() => setColMode('attribute')}
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
                    onChange={e =>
                      setFilterFieldName(e.target.value === 'any' ? null : e.target.value)
                    }
                  >
                    <option value="any">any relation</option>
                    {availableFieldNames.map(fn => (
                      <option key={fn} value={fn}>
                        {fn}
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
                onChange={e => setColEnumFieldId(e.target.value)}
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
            onClick={() => setHideEmptyRows(v => !v)}
          >
            <TbRowRemove size={10} />
          </button>
          <button
            type="button"
            data-active={hideEmptyCols ? 'true' : 'false'}
            title="Hide empty cols"
            onClick={() => setHideEmptyCols(v => !v)}
          >
            <TbColumnRemove size={10} />
          </button>
        </div>
      </div>

      {/* Matrix or empty state */}
      {isEmpty ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>
            {colMode === 'entity' && noRelations
              ? 'No relationships between these entity types'
              : isLoadingRelations
                ? 'Loading relationships…'
                : 'Nothing to display'}
          </div>
          <div className={styles.emptySub}>
            {colMode === 'entity'
              ? 'Try a different column type, or turn off sparse filtering.'
              : 'Select an attribute to see value distribution.'}
          </div>
        </div>
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
                          onClick={() => onEntityClick(col.id)}
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
                          onClick={() => onEntityClick(row._uid)}
                        >
                          <TypeBadge color={rowColor} icon={rowEntry?.schema.icon} size={13} />
                          <span className={styles.rowName}>{row._name}</span>
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
