import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import styles from './BubbleView.module.css';
import { TbChevronDown } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { entityKeys } from '../../../hooks/queryKeys';
import { orpcClient } from '../../../lib/orpcClient';
import { bubbleViewConfigSchema } from '@arch-register/api-types/viewContract';
import { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import type { BrowserEntityRecord } from './entityBrowserState';
import type { JoinedAssessmentContext } from './RadarView';
import {
  getCategoricalFields,
  getNumericFields,
  getCategoricalFieldValues,
  getCategoricalValue,
  getNumericValue,
  getNumericFieldRange,
  type FieldOption
} from './entityFieldSources';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BubbleConfig = {
  xFieldId: string;
  yFieldId: string;
  sizeFieldId: string | null;
  colorFieldId: string | null;
};

type Bubble = {
  id: string;
  name: string;
  description: string;
  schemaName: string;
  colorValue: string | null;
  cx: number;
  cy: number;
  r: number;
  color: string;
  clusterCount: number;
  xDisplay: string;
  yDisplay: string;
  sizeDisplay: string | null;
  colorDisplay: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN_LEFT = 64;
const MARGIN_RIGHT = 24;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 48;
const PLOT_W = 760;
const PLOT_H = 480;
const VB_W = MARGIN_LEFT + PLOT_W + MARGIN_RIGHT;
const VB_H = MARGIN_TOP + PLOT_H + MARGIN_BOTTOM;

const MIN_R = 6;
const MAX_R = 26;
const UNIFORM_R = 10;

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 120;

const LABEL_DENSITY_THRESHOLD = 40;

const BUBBLE_COLORS = [
  'var(--tag-api)',
  'var(--tag-component)',
  'var(--tag-database)',
  'var(--tag-system)',
  'var(--tag-service)',
  'var(--accent-fg)',
  'var(--warning-fg)',
  'oklch(0.62 0.14 180)'
];

const UNIFORM_COLOR = 'var(--accent-fg)';

// ── Config helpers ────────────────────────────────────────────────────────────

const configKey = (workspaceSlug: string) => `ar-bubble-config-${workspaceSlug}`;

const loadConfig = (workspaceSlug: string): BubbleConfig | null => {
  try {
    const raw = localStorage.getItem(configKey(workspaceSlug));
    return raw ? (JSON.parse(raw) as BubbleConfig) : null;
  } catch {
    return null;
  }
};

const saveConfig = (workspaceSlug: string, config: BubbleConfig) => {
  localStorage.setItem(configKey(workspaceSlug), JSON.stringify(config));
};

// Deterministic hash for stable-but-scattered jitter placement (same approach as RadarView's blips).
function rHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

const formatAxisValue = (
  entity: EntityRecord,
  fieldId: string,
  categories: FieldOption[] | null
): string | null => {
  if (categories) {
    const value = getCategoricalValue(entity, fieldId);
    if (value == null) return null;
    return categories.find(c => c.id === value)?.label ?? value;
  }
  const value = getNumericValue(entity, fieldId);
  return value == null ? null : formatNumber(value);
};

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
  const [internalConfig, setInternalConfig] = useState<BubbleConfig | null>(() =>
    loadConfig(workspaceSlug)
  );
  const parsedConfig = useMemo(() => {
    const result = bubbleViewConfigSchema.safeParse(configProp);
    return result.success ? result.data : null;
  }, [configProp]);
  const config = parsedConfig ?? internalConfig;

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  useEffect(
    () => () => {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  const clearTimers = () => {
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  };

  const scheduleOpen = (id: string) => {
    clearTimers();
    openTimerRef.current = window.setTimeout(() => setHoveredId(id), OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => setHoveredId(null), CLOSE_DELAY_MS);
  };

  // Rows arrive in 'summary' view; custom select/number fields need the full-view records.
  // Fields are unioned across every schema present in the current rows (not schema-scoped),
  // so fetch the full-view records per row schema, the same way MatrixView's attribute mode does.
  const rowSchemaIds = useMemo(() => [...new Set(rows.map(r => r._schema.id))], [rows]);
  const schemasInScope = useMemo(
    () => schemas.filter(s => rowSchemaIds.includes(s.id)),
    [schemas, rowSchemaIds]
  );

  const fullEntityResults = useQueries({
    queries: rowSchemaIds.map(schemaId => ({
      queryKey: entityKeys.list(workspaceSlug, { schemaId, view: 'full' }),
      queryFn: () =>
        orpcClient.entities.list({
          params: { workspace: workspaceSlug },
          query: { _schemaId: schemaId, view: 'full' }
        }),
      enabled: !!workspaceSlug
    }))
  });

  const fullEntityMap = useMemo(() => {
    const rowUids = new Set(rows.map(r => r._uid));
    const m = new Map<string, EntityRecord>();
    fullEntityResults.forEach(result => {
      result.data?.forEach(e => {
        if (rowUids.has(e._uid)) m.set(e._uid, e);
      });
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullEntityResults, rows]);

  const entities = useMemo(
    () =>
      rows.map(r => {
        const full = fullEntityMap.get(r._uid);
        return full ? ({ ...full, _assessment: r._assessment } as BrowserEntityRecord) : r;
      }),
    [rows, fullEntityMap]
  );

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
      if (onConfigChange) {
        onConfigChange(newConfig);
      } else {
        saveConfig(workspaceSlug, newConfig);
        setInternalConfig(newConfig);
      }
      setHoveredId(null);
    },
    [onConfigChange, workspaceSlug]
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

  const posForAxis = useCallback(
    (
      entity: EntityRecord,
      fieldId: string,
      range: { min: number; max: number } | null,
      categories: FieldOption[] | null,
      pixelMin: number,
      pixelMax: number,
      invert: boolean
    ): number | null => {
      let t: number | null = null;
      if (categories) {
        const value = getCategoricalValue(entity, fieldId);
        const idx = value == null ? -1 : categories.findIndex(c => c.id === value);
        if (idx === -1) return null;
        t = (idx + 0.5) / categories.length;
      } else if (range) {
        const value = getNumericValue(entity, fieldId);
        if (value == null) return null;
        t = range.max === range.min ? 0.5 : (value - range.min) / (range.max - range.min);
      }
      if (t == null) return null;
      const clamped = Math.min(1, Math.max(0, t));
      return invert
        ? pixelMax - clamped * (pixelMax - pixelMin)
        : pixelMin + clamped * (pixelMax - pixelMin);
    },
    []
  );

  const { bubbles, clusterBadges } = useMemo((): {
    bubbles: Bubble[];
    clusterBadges: { cx: number; cy: number; count: number }[];
  } => {
    if (!config) return { bubbles: [], clusterBadges: [] };
    const raw = entities
      .map(e => {
        const cx = posForAxis(
          e,
          config.xFieldId,
          xRange,
          xCategories,
          MARGIN_LEFT,
          MARGIN_LEFT + PLOT_W,
          false
        );
        const cy = posForAxis(
          e,
          config.yFieldId,
          yRange,
          yCategories,
          MARGIN_TOP,
          MARGIN_TOP + PLOT_H,
          true
        );
        if (cx == null || cy == null) return null;

        let r = UNIFORM_R;
        if (config.sizeFieldId && sizeRange) {
          const value = getNumericValue(e, config.sizeFieldId);
          if (value != null) {
            const t =
              sizeRange.max === sizeRange.min
                ? 0.5
                : (value - sizeRange.min) / (sizeRange.max - sizeRange.min);
            const clamped = Math.min(1, Math.max(0, t));
            r = MIN_R + Math.sqrt(clamped) * (MAX_R - MIN_R);
          }
        }

        const colorValue = config.colorFieldId ? getCategoricalValue(e, config.colorFieldId) : null;
        const color = config.colorFieldId
          ? colorValue != null
            ? (colorMap.get(colorValue) ?? UNIFORM_COLOR)
            : UNIFORM_COLOR
          : UNIFORM_COLOR;

        return {
          id: e._uid,
          name: e._name ?? e._slug,
          description: e._description ?? '',
          schemaName: e._schema?.name ?? '',
          colorValue,
          cx,
          cy,
          r,
          color,
          clusterCount: 1,
          xDisplay: formatAxisValue(e, config.xFieldId, xCategories) ?? '—',
          yDisplay: formatAxisValue(e, config.yFieldId, yCategories) ?? '—',
          sizeDisplay: config.sizeFieldId ? formatAxisValue(e, config.sizeFieldId, null) : null,
          colorDisplay:
            colorValue != null
              ? (colorCategories.find(c => c.id === colorValue)?.label ?? colorValue)
              : null
        } satisfies Bubble;
      })
      .filter((b): b is Bubble => b != null);

    // Jitter overlapping bubbles apart, grouped by rounded pixel bucket.
    const buckets = new Map<string, Bubble[]>();
    raw.forEach(b => {
      const key = `${Math.round(b.cx / 8)}_${Math.round(b.cy / 8)}`;
      const list = buckets.get(key) ?? [];
      list.push(b);
      buckets.set(key, list);
    });

    const result: Bubble[] = [];
    const badges: { cx: number; cy: number; count: number }[] = [];
    buckets.forEach(group => {
      if (group.length === 1) {
        result.push(group[0]!);
        return;
      }
      const cx0 = group.reduce((s, b) => s + b.cx, 0) / group.length;
      const cy0 = group.reduce((s, b) => s + b.cy, 0) / group.length;
      const jitterR = 10 + 4 * Math.sqrt(group.length);
      badges.push({ cx: cx0, cy: cy0 - jitterR - 8, count: group.length });
      group.forEach((b, i) => {
        // Base angle evenly spread around the cluster, perturbed by a per-entity hash so
        // bubbles don't line up in an obviously regular polygon.
        const baseAngle = (2 * Math.PI * i) / group.length;
        const h1 = rHash(`${b.id}~jitter-angle`);
        const h2 = rHash(`${b.id}~jitter-radius`);
        const angle = baseAngle + ((h1 % 1000) / 1000 - 0.5) * ((2 * Math.PI) / group.length) * 0.9;
        const radius = jitterR * (0.55 + ((h2 % 1000) / 1000) * 0.7);
        result.push({
          ...b,
          cx: cx0 + radius * Math.cos(angle),
          cy: cy0 + radius * Math.sin(angle),
          clusterCount: group.length
        });
      });
    });

    return { bubbles: result, clusterBadges: badges };
  }, [
    config,
    entities,
    posForAxis,
    xRange,
    yRange,
    xCategories,
    yCategories,
    sizeRange,
    colorMap,
    colorCategories
  ]);

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
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Bubble chart not configured</div>
            <div>Map fields to the X, Y, size and colour axes above.</div>
          </div>
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
                    <div className={styles.tooltipChips}>
                      <span className={styles.tooltipChip}>{activeBubble.schemaName}</span>
                    </div>
                  )}
                  <div className={styles.tooltipRows}>
                    <div className={styles.tooltipRow}>
                      <span className={styles.tooltipLabel}>{xLabel}</span>
                      <span className={styles.tooltipValue}>{activeBubble.xDisplay}</span>
                    </div>
                    <div className={styles.tooltipRow}>
                      <span className={styles.tooltipLabel}>{yLabel}</span>
                      <span className={styles.tooltipValue}>{activeBubble.yDisplay}</span>
                    </div>
                    {activeBubble.sizeDisplay != null && (
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>{sizeLabel}</span>
                        <span className={styles.tooltipValue}>{activeBubble.sizeDisplay}</span>
                      </div>
                    )}
                    {activeBubble.colorDisplay != null && (
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>{colorLabel}</span>
                        <span className={styles.tooltipValue} style={{ color: activeBubble.color }}>
                          {activeBubble.colorDisplay}
                        </span>
                      </div>
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
