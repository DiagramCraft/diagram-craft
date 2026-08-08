import { useCallback, useEffect, useMemo, useState } from 'react';
import { TbChevronDown } from 'react-icons/tb';
import { Popover } from '@diagram-craft/app-components/Popover';
import { EmptyState } from '../../../components/EmptyState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { heatmapViewConfigSchema } from '@arch-register/api-types/viewContract';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import {
  getCategoricalFields,
  getCategoricalFieldValues,
  getNumericFields,
  getNumericFieldRange,
  type FieldOption,
  type JoinedAssessmentContext
} from './entityFieldSources';
import { normalizeViewConfig } from './entityViewConfig';
import {
  buildAxisBuckets,
  buildHeatmapCells,
  severityColorForCell,
  severityColorForValue,
  type HeatmapConfig
} from './heatmapViewState';
import { textColorForFill } from './mapColorScales';
import { useHydratedEntityRows } from '../../../hooks/useHydratedEntityRows';
import { usePersistedViewConfig } from '../../../hooks/usePersistedViewConfig';
import styles from './HeatmapView.module.css';

export type { HeatmapConfig } from './heatmapViewState';

// heatmapViewConfigSchema has no sensible non-empty defaults (axis fields are
// workspace-specific), so normalizeViewConfig is given an empty sentinel and the result is
// treated as "unconfigured" whenever likelihoodFieldId is empty — same all-or-nothing
// `config: HeatmapConfig | null` pattern BubbleView uses for its axis config.
const EMPTY_HEATMAP_CONFIG: HeatmapConfig = {
  likelihoodFieldId: '',
  impactFieldId: '',
  buckets: 5,
  colorFieldId: null
};

export const HeatmapView = ({
  rows,
  linkedEntityIds,
  onEntityClick,
  config: configProp,
  onConfigChange,
  hideToolbar,
  joinedAssessment
}: EntityBrowserRowViewProps & {
  config?: unknown;
  onConfigChange?: (config: HeatmapConfig) => void;
  hideToolbar?: boolean;
  joinedAssessment?: JoinedAssessmentContext | null;
}) => {
  const { workspaceSlug, schemas, lifecycleStates, teams } = useWorkspaceContext();
  const parsedConfig = useMemo(() => {
    const normalized = normalizeViewConfig(
      heatmapViewConfigSchema,
      configProp,
      EMPTY_HEATMAP_CONFIG
    );
    return normalized.likelihoodFieldId ? normalized : null;
  }, [configProp]);
  const [config, setConfig] = usePersistedViewConfig({
    storageKey: `ar-heatmap-config-${workspaceSlug}`,
    externalConfig: parsedConfig,
    onChange: onConfigChange
  });

  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: number;
    x: number;
    y: number;
  } | null>(null);

  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  const rowSchemaIds = useMemo(() => [...new Set(rows.map(r => r._schema.id))], [rows]);
  const schemasInScope = useMemo(
    () => schemas.filter(s => rowSchemaIds.includes(s.id)),
    [schemas, rowSchemaIds]
  );

  const entities = useHydratedEntityRows(workspaceSlug, rows);

  const categoricalFields = useMemo(
    () => getCategoricalFields(schemasInScope, lifecycleStates, teams, joinedAssessment),
    [schemasInScope, lifecycleStates, teams, joinedAssessment]
  );
  const numericFields = useMemo(
    () => getNumericFields(schemasInScope, joinedAssessment),
    [schemasInScope, joinedAssessment]
  );
  const axisFieldOptions: FieldOption[] = useMemo(
    () => [...numericFields, ...categoricalFields],
    [numericFields, categoricalFields]
  );

  const isNumericField = useCallback(
    (fieldId: string) => numericFields.some(f => f.id === fieldId),
    [numericFields]
  );

  const applyConfig = useCallback(
    (newConfig: HeatmapConfig) => {
      setConfig(newConfig);
      setActiveCell(null);
    },
    [setConfig]
  );

  useEffect(() => {
    if (config || axisFieldOptions.length === 0) return;
    applyConfig({
      likelihoodFieldId: axisFieldOptions[0]?.id ?? '',
      impactFieldId: axisFieldOptions[1]?.id ?? axisFieldOptions[0]?.id ?? '',
      buckets: 5,
      colorFieldId: null
    });
  }, [config, axisFieldOptions, applyConfig]);

  const likelihoodCategories = useMemo(() => {
    if (!config || isNumericField(config.likelihoodFieldId)) return null;
    return getCategoricalFieldValues(
      schemasInScope,
      config.likelihoodFieldId,
      lifecycleStates,
      teams,
      joinedAssessment
    );
  }, [config, schemasInScope, lifecycleStates, teams, joinedAssessment, isNumericField]);

  const impactCategories = useMemo(() => {
    if (!config || isNumericField(config.impactFieldId)) return null;
    return getCategoricalFieldValues(
      schemasInScope,
      config.impactFieldId,
      lifecycleStates,
      teams,
      joinedAssessment
    );
  }, [config, schemasInScope, lifecycleStates, teams, joinedAssessment, isNumericField]);

  const likelihoodRange = useMemo(() => {
    if (!config || !isNumericField(config.likelihoodFieldId)) return null;
    return getNumericFieldRange(
      schemasInScope,
      config.likelihoodFieldId,
      joinedAssessment,
      entities
    );
  }, [config, schemasInScope, entities, joinedAssessment, isNumericField]);

  const impactRange = useMemo(() => {
    if (!config || !isNumericField(config.impactFieldId)) return null;
    return getNumericFieldRange(schemasInScope, config.impactFieldId, joinedAssessment, entities);
  }, [config, schemasInScope, entities, joinedAssessment, isNumericField]);

  const colorRange = useMemo(() => {
    if (!config?.colorFieldId) return null;
    return getNumericFieldRange(schemasInScope, config.colorFieldId, joinedAssessment, entities);
  }, [config, schemasInScope, entities, joinedAssessment]);

  const likelihoodBuckets = useMemo(
    () => (config ? buildAxisBuckets(likelihoodCategories, likelihoodRange, config.buckets) : []),
    [config, likelihoodCategories, likelihoodRange]
  );
  const impactBuckets = useMemo(
    () => (config ? buildAxisBuckets(impactCategories, impactRange, config.buckets) : []),
    [config, impactCategories, impactRange]
  );

  const { cells, unmappedCount } = useMemo(() => {
    if (!config || likelihoodBuckets.length === 0 || impactBuckets.length === 0) {
      return { cells: [], unmappedCount: 0 };
    }
    return buildHeatmapCells({
      entities,
      config,
      likelihoodBuckets,
      impactBuckets,
      likelihoodCategories,
      impactCategories,
      likelihoodRange,
      impactRange
    });
  }, [
    config,
    entities,
    likelihoodBuckets,
    impactBuckets,
    likelihoodCategories,
    impactCategories,
    likelihoodRange,
    impactRange
  ]);

  const entityById = useMemo(() => new Map(entities.map(e => [e._uid, e])), [entities]);

  const likelihoodLabel =
    axisFieldOptions.find(f => f.id === config?.likelihoodFieldId)?.label ?? '';
  const impactLabel = axisFieldOptions.find(f => f.id === config?.impactFieldId)?.label ?? '';
  const colorLabel = numericFields.find(f => f.id === config?.colorFieldId)?.label ?? '';

  const activeCellData =
    activeCell != null ? (cells[activeCell.row]?.[activeCell.col] ?? null) : null;

  return (
    <div className={styles.screen}>
      {!hideToolbar && (
        <div className={styles.config}>
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Likelihood</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.likelihoodFieldId ?? ''}
                disabled={axisFieldOptions.length === 0}
                onChange={e =>
                  config && applyConfig({ ...config, likelihoodFieldId: e.target.value })
                }
              >
                {axisFieldOptions.length === 0 && <option value="">—</option>}
                {axisFieldOptions.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Impact</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.impactFieldId ?? ''}
                disabled={axisFieldOptions.length === 0}
                onChange={e => config && applyConfig({ ...config, impactFieldId: e.target.value })}
              >
                {axisFieldOptions.length === 0 && <option value="">—</option>}
                {axisFieldOptions.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Bands</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.buckets ?? 5}
                disabled={!config}
                onChange={e =>
                  config && applyConfig({ ...config, buckets: Number(e.target.value) })
                }
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Cell colour</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.colorFieldId ?? ''}
                disabled={!config}
                onChange={e =>
                  config && applyConfig({ ...config, colorFieldId: e.target.value || null })
                }
              >
                <option value="">Severity (position)</option>
                {numericFields.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          {axisFieldOptions.length === 0 && (
            <span className={styles.noFields}>
              No numeric or categorical fields available across the current entities.
            </span>
          )}
        </div>
      )}

      <div className={styles.content}>
        {!config ? (
          <EmptyState
            title="Heat map not configured"
            subtitle="Map fields to the likelihood and impact axes above."
          />
        ) : (
          <div className={styles.body}>
            <div className={styles.gridWrap}>
              <div
                className={styles.grid}
                style={{ gridTemplateColumns: `auto auto repeat(${impactBuckets.length}, 1fr)` }}
              >
                <div className={styles.titleCorner} />
                <div className={styles.titleCorner} />
                <div
                  className={styles.xAxisTitle}
                  style={{ gridColumn: `3 / span ${impactBuckets.length}` }}
                >
                  {impactLabel || 'Impact'}
                </div>

                <div
                  className={styles.yAxisTitle}
                  style={{ gridRow: `2 / span ${likelihoodBuckets.length + 1}` }}
                >
                  <span>{likelihoodLabel || 'Likelihood'}</span>
                </div>
                <div className={styles.corner} />
                {impactBuckets.map(bucket => (
                  <div key={bucket.id} className={styles.colHeader}>
                    {bucket.label}
                  </div>
                ))}

                {likelihoodBuckets.map((rowBucket, row) => (
                  <div className={styles.rowGroup} key={rowBucket.id}>
                    <div className={styles.rowHeader}>{rowBucket.label}</div>
                    {impactBuckets.map((_, col) => {
                      const cell = cells[row]?.[col];
                      const count = cell?.count ?? 0;
                      const color =
                        config.colorFieldId && colorRange && cell?.colorValue != null
                          ? severityColorForValue(cell.colorValue, colorRange.min, colorRange.max)
                          : severityColorForCell(
                              row,
                              col,
                              likelihoodBuckets.length,
                              impactBuckets.length
                            );
                      const textColor = textColorForFill(color);
                      return (
                        <button
                          key={col}
                          type="button"
                          className={styles.cell}
                          style={{ background: color, color: textColor }}
                          disabled={count === 0}
                          onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveCell({
                              row,
                              col,
                              x: rect.left + rect.width / 2,
                              y: rect.bottom
                            });
                          }}
                        >
                          {count}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {unmappedCount > 0 && (
              <div className={styles.unmapped}>
                {unmappedCount} {unmappedCount === 1 ? 'entity has' : 'entities have'} no{' '}
                {likelihoodLabel || 'likelihood'} or {impactLabel || 'impact'} value and{' '}
                {unmappedCount === 1 ? "isn't" : "aren't"} shown in the grid.
              </div>
            )}

            {config.colorFieldId && (
              <div className={styles.legendNote}>Cell colour reflects average {colorLabel}.</div>
            )}
          </div>
        )}
      </div>

      {activeCell && activeCellData && (
        <Popover.Imperative
          x={activeCell.x}
          y={activeCell.y}
          onClose={() => setActiveCell(null)}
          className={styles.cellPopover}
        >
          <div className={styles.cellPopoverHeader}>
            {likelihoodBuckets[activeCell.row]?.label} × {impactBuckets[activeCell.col]?.label} (
            {activeCellData.count})
          </div>
          <div className={styles.cellPopoverList}>
            {activeCellData.entityIds.map(id => {
              const entity = entityById.get(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={styles.cellPopoverItem}
                  onClick={() => onEntityClick(id)}
                >
                  <span
                    className={styles.cellPopoverName}
                    style={
                      linkedEntityIds == null || linkedEntityIdSet.has(id)
                        ? undefined
                        : { opacity: 0.5 }
                    }
                  >
                    {entity?._name ?? entity?._slug ?? id}
                  </span>
                </button>
              );
            })}
          </div>
        </Popover.Imperative>
      )}
    </div>
  );
};
