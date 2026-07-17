import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import styles from './BubbleView.module.css';
import { TbChevronDown } from 'react-icons/tb';
import { EmptyState } from '../../../components/EmptyState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { bubbleViewConfigSchema } from '@arch-register/api-types/viewContract';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import {
  getCategoricalFields,
  getNumericFields,
  getCategoricalFieldValues,
  getNumericFieldRange,
  type FieldOption,
  type JoinedAssessmentContext
} from './entityFieldSources';
import { normalizeViewConfig } from './entityViewConfig';
import { TooltipChip, TooltipChips, TooltipRow } from '../../../components/HoverCardParts';
import {
  BUBBLE_COLORS,
  MARGIN_LEFT,
  MARGIN_TOP,
  PLOT_H,
  PLOT_W,
  VB_H,
  VB_W,
  buildBubbles,
  type BubbleConfig
} from './bubbleViewState';
import { useHydratedEntityRows } from '../../../hooks/useHydratedEntityRows';
import { useDelayedDisclosure } from '../../../hooks/useDelayedDisclosure';
import { usePersistedViewConfig } from '../../../hooks/usePersistedViewConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type { BubbleConfig } from './bubbleViewState';

// bubbleViewConfigSchema has no sensible non-empty defaults (all fields are workspace-specific
// selections), so normalizeViewConfig is given an empty sentinel here and the result is treated
// as "unconfigured" (converted back to null) whenever xFieldId is empty, preserving the existing
// all-or-nothing `config: BubbleConfig | null` semantics used throughout this component.
const EMPTY_BUBBLE_CONFIG: BubbleConfig = {
  xFieldId: '',
  yFieldId: '',
  sizeFieldId: null,
  colorFieldId: null
};

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 120;

const LABEL_DENSITY_THRESHOLD = 40;

// ── Config helpers ────────────────────────────────────────────────────────────

// ── BubbleView ────────────────────────────────────────────────────────────────

export const BubbleView = ({
  rows,
  linkedEntityIds,
  onEntityClick,
  config: configProp,
  onConfigChange,
  hideToolbar,
  joinedAssessment
}: EntityBrowserRowViewProps & {
  config?: unknown;
  onConfigChange?: (config: BubbleConfig) => void;
  hideToolbar?: boolean;
  joinedAssessment?: JoinedAssessmentContext | null;
}) => {
  const { workspaceSlug, schemas, lifecycleStates, teams } = useWorkspaceContext();
  const parsedConfig = useMemo(() => {
    const normalized = normalizeViewConfig(bubbleViewConfigSchema, configProp, EMPTY_BUBBLE_CONFIG);
    return normalized.xFieldId ? normalized : null;
  }, [configProp]);
  const [config, setConfig] = usePersistedViewConfig({
    storageKey: `ar-bubble-config-${workspaceSlug}`,
    externalConfig: parsedConfig,
    onChange: onConfigChange
  });

  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoverTargetRef = useRef<string | null>(null);
  const hoverDisclosure = useDelayedDisclosure(OPEN_DELAY_MS, CLOSE_DELAY_MS);
  const hoveredId = hoverDisclosure.open ? hoverTargetRef.current : null;
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  const scheduleOpen = (id: string) => {
    hoverTargetRef.current = id;
    hoverDisclosure.scheduleOpen();
  };

  const scheduleClose = hoverDisclosure.scheduleClose;

  // Rows arrive in 'summary' view; custom select/number fields need the full-view records.
  // Fields are unioned across every schema present in the current rows (not schema-scoped),
  // so fetch the full-view records per row schema, the same way MatrixView's attribute mode does.
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
    (newConfig: BubbleConfig) => {
      setConfig(newConfig);
      hoverDisclosure.setOpen(false);
    },
    [setConfig, hoverDisclosure]
  );

  useEffect(() => {
    if (config || axisFieldOptions.length === 0) return;
    applyConfig({
      xFieldId: axisFieldOptions[0]?.id ?? '',
      yFieldId: axisFieldOptions[1]?.id ?? axisFieldOptions[0]?.id ?? '',
      sizeFieldId: null,
      colorFieldId: null
    });
  }, [config, axisFieldOptions, applyConfig]);

  // ── Scales ──────────────────────────────────────────────────────────────────

  const xRange = useMemo(() => {
    if (!config || !isNumericField(config.xFieldId)) return null;
    return getNumericFieldRange(schemasInScope, config.xFieldId, joinedAssessment, entities);
  }, [config, schemasInScope, entities, joinedAssessment, isNumericField]);

  const yRange = useMemo(() => {
    if (!config || !isNumericField(config.yFieldId)) return null;
    return getNumericFieldRange(schemasInScope, config.yFieldId, joinedAssessment, entities);
  }, [config, schemasInScope, entities, joinedAssessment, isNumericField]);

  const sizeRange = useMemo(() => {
    if (!config?.sizeFieldId) return null;
    return getNumericFieldRange(schemasInScope, config.sizeFieldId, joinedAssessment, entities);
  }, [config, schemasInScope, entities, joinedAssessment]);

  const xCategories = useMemo(() => {
    if (!config || isNumericField(config.xFieldId)) return null;
    return getCategoricalFieldValues(
      schemasInScope,
      config.xFieldId,
      lifecycleStates,
      teams,
      joinedAssessment
    );
  }, [config, schemasInScope, lifecycleStates, teams, joinedAssessment, isNumericField]);

  const yCategories = useMemo(() => {
    if (!config || isNumericField(config.yFieldId)) return null;
    return getCategoricalFieldValues(
      schemasInScope,
      config.yFieldId,
      lifecycleStates,
      teams,
      joinedAssessment
    );
  }, [config, schemasInScope, lifecycleStates, teams, joinedAssessment, isNumericField]);

  const colorCategories = useMemo(() => {
    if (!config?.colorFieldId) return [];
    return getCategoricalFieldValues(
      schemasInScope,
      config.colorFieldId,
      lifecycleStates,
      teams,
      joinedAssessment
    );
  }, [config, schemasInScope, lifecycleStates, teams, joinedAssessment]);

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    colorCategories.forEach((c, i) => m.set(c.id, BUBBLE_COLORS[i % BUBBLE_COLORS.length]!));
    return m;
  }, [colorCategories]);

  const { bubbles, clusterBadges } = useMemo(
    () =>
      buildBubbles({
        entities,
        config,
        xRange,
        yRange,
        sizeRange,
        xCategories,
        yCategories,
        colorCategories,
        colorMap
      }),
    [
      entities,
      config,
      xRange,
      yRange,
      sizeRange,
      xCategories,
      yCategories,
      colorCategories,
      colorMap
    ]
  );

  const showLabels = bubbles.length <= LABEL_DENSITY_THRESHOLD;

  const activeBubble = useMemo(
    () => (hoveredId ? (bubbles.find(b => b.id === hoveredId) ?? null) : null),
    [hoveredId, bubbles]
  );

  const onSvgMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setTipPos({
      x: mx > rect.width - 290 ? mx - 278 : mx + 18,
      y: my > rect.height - 130 ? my - 120 : my + 4
    });
  }, []);

  const xLabel = axisFieldOptions.find(f => f.id === config?.xFieldId)?.label ?? '';
  const yLabel = axisFieldOptions.find(f => f.id === config?.yFieldId)?.label ?? '';
  const sizeLabel = numericFields.find(f => f.id === config?.sizeFieldId)?.label ?? '';
  const colorLabel = categoricalFields.find(f => f.id === config?.colorFieldId)?.label ?? '';

  return (
    <div className={styles.screen}>
      {!hideToolbar && (
        <div className={styles.config}>
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>X axis</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.xFieldId ?? ''}
                disabled={axisFieldOptions.length === 0}
                onChange={e => config && applyConfig({ ...config, xFieldId: e.target.value })}
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
            <span className={styles.axisKicker}>Y axis</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.yFieldId ?? ''}
                disabled={axisFieldOptions.length === 0}
                onChange={e => config && applyConfig({ ...config, yFieldId: e.target.value })}
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
            <span className={styles.axisKicker}>Size</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.sizeFieldId ?? ''}
                disabled={!config}
                onChange={e =>
                  config && applyConfig({ ...config, sizeFieldId: e.target.value || null })
                }
              >
                <option value="">Uniform</option>
                {numericFields.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Color</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.colorFieldId ?? ''}
                disabled={!config}
                onChange={e =>
                  config && applyConfig({ ...config, colorFieldId: e.target.value || null })
                }
              >
                <option value="">Uniform</option>
                {categoricalFields.map(f => (
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
            title="Bubble chart not configured"
            subtitle="Map fields to the X, Y, size and colour axes above."
          />
        ) : (
          <div className={styles.body}>
            <div className={styles.svgWrap} ref={wrapRef} onMouseMove={onSvgMouseMove}>
              <svg
                className={styles.svg}
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                preserveAspectRatio="xMidYMid meet"
                overflow="visible"
              >
                {/* Axes */}
                <line
                  x1={MARGIN_LEFT}
                  y1={MARGIN_TOP + PLOT_H}
                  x2={MARGIN_LEFT + PLOT_W}
                  y2={MARGIN_TOP + PLOT_H}
                  stroke="var(--panel-border)"
                  strokeWidth="1"
                />
                <line
                  x1={MARGIN_LEFT}
                  y1={MARGIN_TOP}
                  x2={MARGIN_LEFT}
                  y2={MARGIN_TOP + PLOT_H}
                  stroke="var(--panel-border)"
                  strokeWidth="1"
                />
                <text
                  x={MARGIN_LEFT + PLOT_W / 2}
                  y={VB_H - 10}
                  textAnchor="middle"
                  style={{ fontSize: 11, fill: 'var(--base-fg-more-dim)' }}
                >
                  {xLabel}
                </text>
                <text
                  x={14}
                  y={MARGIN_TOP + PLOT_H / 2}
                  textAnchor="middle"
                  transform={`rotate(-90, 14, ${MARGIN_TOP + PLOT_H / 2})`}
                  style={{ fontSize: 11, fill: 'var(--base-fg-more-dim)' }}
                >
                  {yLabel}
                </text>

                {bubbles.map(b => (
                  <g
                    key={b.id}
                    transform={`translate(${b.cx.toFixed(1)},${b.cy.toFixed(1)})`}
                    onClick={() => onEntityClick(b.id)}
                    onMouseEnter={() => scheduleOpen(b.id)}
                    onMouseLeave={scheduleClose}
                    style={{
                      cursor: 'pointer',
                      opacity: linkedEntityIds != null && !linkedEntityIdSet.has(b.id) ? 0.4 : 1
                    }}
                  >
                    {hoveredId === b.id && (
                      <circle
                        r={b.r + 4}
                        fill="none"
                        stroke={b.color}
                        strokeWidth="1.5"
                        opacity="0.55"
                      />
                    )}
                    <circle r={b.r} fill={b.color} opacity="0.85" />
                    {showLabels && (
                      <text
                        y={b.r + 11}
                        textAnchor="middle"
                        style={{
                          fontSize: 9,
                          fill: 'var(--base-fg-dim)',
                          pointerEvents: 'none',
                          userSelect: 'none'
                        }}
                      >
                        {b.name}
                      </text>
                    )}
                  </g>
                ))}

                {clusterBadges.map((c, i) => (
                  <g key={i} transform={`translate(${c.cx.toFixed(1)},${c.cy.toFixed(1)})`}>
                    <rect
                      x={-14}
                      y={-8}
                      width={28}
                      height={16}
                      rx={8}
                      fill="var(--cmp-bg)"
                      stroke="var(--panel-border)"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      dy="0.5"
                      style={{ fontSize: 9, fontWeight: 600, fill: 'var(--base-fg)' }}
                    >
                      ×{c.count}
                    </text>
                  </g>
                ))}
              </svg>

              {activeBubble && (
                <div className={styles.tooltip} style={{ left: tipPos.x, top: tipPos.y }}>
                  <div className={styles.tooltipHead}>
                    <span
                      className={styles.tooltipName}
                      style={
                        linkedEntityIds == null || linkedEntityIdSet.has(activeBubble.id)
                          ? undefined
                          : { color: 'var(--base-fg-more-dim)' }
                      }
                    >
                      {activeBubble.name}
                    </span>
                  </div>
                  {activeBubble.schemaName && (
                    <TooltipChips>
                      <TooltipChip>{activeBubble.schemaName}</TooltipChip>
                    </TooltipChips>
                  )}
                  <div className={styles.tooltipRows}>
                    <TooltipRow label={xLabel} value={activeBubble.xDisplay} />
                    <TooltipRow label={yLabel} value={activeBubble.yDisplay} />
                    {activeBubble.sizeDisplay != null && (
                      <TooltipRow label={sizeLabel} value={activeBubble.sizeDisplay} />
                    )}
                    {activeBubble.colorDisplay != null && (
                      <TooltipRow
                        label={colorLabel}
                        value={activeBubble.colorDisplay}
                        valueStyle={{ color: activeBubble.color }}
                      />
                    )}
                  </div>
                  {activeBubble.description && (
                    <div className={styles.tooltipDesc}>{activeBubble.description}</div>
                  )}
                </div>
              )}
            </div>

            {config.colorFieldId && colorCategories.length > 0 && (
              <div className={styles.legend}>
                <div className={styles.legendHead}>
                  <span>Legend</span>
                  <span className={styles.legendCount}>{bubbles.length} shown</span>
                </div>
                <div className={styles.legendScroll}>
                  {colorCategories.map((c, i) => (
                    <div key={c.id} className={styles.legendRow}>
                      <span
                        className={styles.legendDot}
                        style={{ background: BUBBLE_COLORS[i % BUBBLE_COLORS.length] }}
                      />
                      <span className={styles.legendLabel}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
