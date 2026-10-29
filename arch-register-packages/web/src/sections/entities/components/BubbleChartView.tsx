import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import styles from './BubbleChartView.module.css';
import { TbGrid3X3 } from 'react-icons/tb';
import { ToolbarButton } from '../../../components/ToolbarButton';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { EmptyState } from '../../../components/EmptyState';
import { MixedSchemasWarning } from '../../../components/MixedSchemasWarning';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { bubbleViewConfigSchema } from '@arch-register/api-types/viewContract';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import {
  getCategoricalFieldValues,
  getNumericFieldRange,
  type JoinedAssessmentContext
} from './entityFieldSources';
import {
  keepKnownFieldId,
  repairAxisPair,
  useAxisFieldOptions,
  useSeedDefaultConfig
} from './useAxisFieldOptions';
import { normalizeViewConfig } from './entityViewConfig';
import { TooltipChip, TooltipChips, TooltipRow } from '../../../components/HoverCardParts';
import {
  BUBBLE_COLORS,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  MARGIN_TOP,
  PLOT_H,
  PLOT_W,
  buildBubbles,
  DEFAULT_BUBBLE_QUADRANTS,
  type BubbleConfig
} from './bubbleChartState';
import { useHydratedEntityRows } from '../../../hooks/useHydratedEntityRows';
import { useDelayedDisclosure } from '../../../hooks/useDelayedDisclosure';
import { usePersistedViewConfig } from '../../../hooks/usePersistedViewConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type { BubbleConfig } from './bubbleChartState';

// bubbleViewConfigSchema has no sensible non-empty defaults (all fields are workspace-specific
// selections), so normalizeViewConfig is given an empty sentinel here and the result is treated
// as "unconfigured" (converted back to null) whenever xFieldId is empty, preserving the existing
// all-or-nothing `config: BubbleConfig | null` semantics used throughout this component.
const EMPTY_BUBBLE_CONFIG: BubbleConfig = {
  xFieldId: '',
  yFieldId: '',
  sizeFieldId: null,
  colorFieldId: null,
  quadrants: DEFAULT_BUBBLE_QUADRANTS
};

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 120;

const LABEL_DENSITY_THRESHOLD = 40;
const MIN_PLOT_W = 240;
const MIN_PLOT_H = 160;

// ── Config helpers ────────────────────────────────────────────────────────────

// ── BubbleChartView ────────────────────────────────────────────────────────────────

export const BubbleChartView = ({
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
  const { workspaceSlug, lifecycleStates, teams } = useWorkspaceContext();
  const parsedConfig = useMemo(() => {
    const normalized = normalizeViewConfig(bubbleViewConfigSchema, configProp, EMPTY_BUBBLE_CONFIG);
    return normalized.xFieldId ? normalized : null;
  }, [configProp]);
  const [rawConfig, setConfig] = usePersistedViewConfig({
    storageKey: `ar-bubble-config-${workspaceSlug}`,
    externalConfig: parsedConfig,
    onChange: onConfigChange
  });
  const quadrantsActionsRef = useRef<PopoverActions | null>(null);

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
  const { schemasInScope, categoricalFields, numericFields, axisFieldOptions, isNumericField } =
    useAxisFieldOptions(rows, joinedAssessment);
  const hasMixedSchemas = useMemo(() => new Set(rows.map(r => r._schema.id)).size > 1, [rows]);
  const entities = useHydratedEntityRows(workspaceSlug, rows);

  const config = useMemo((): BubbleConfig | null => {
    if (!rawConfig || axisFieldOptions.length === 0) return rawConfig;
    const [xFieldId, yFieldId] = repairAxisPair(
      axisFieldOptions,
      rawConfig.xFieldId,
      rawConfig.yFieldId
    );
    const sizeFieldId = keepKnownFieldId(numericFields, rawConfig.sizeFieldId);
    const colorFieldId = keepKnownFieldId(categoricalFields, rawConfig.colorFieldId);
    return xFieldId === rawConfig.xFieldId &&
      yFieldId === rawConfig.yFieldId &&
      sizeFieldId === rawConfig.sizeFieldId &&
      colorFieldId === rawConfig.colorFieldId
      ? rawConfig
      : { ...rawConfig, xFieldId, yFieldId, sizeFieldId, colorFieldId };
  }, [rawConfig, axisFieldOptions, numericFields, categoricalFields]);

  const setHoverOpen = hoverDisclosure.setOpen;
  const applyConfig = useCallback(
    (newConfig: BubbleConfig) => {
      setConfig(newConfig);
      setHoverOpen(false);
    },
    [setConfig, setHoverOpen]
  );

  useSeedDefaultConfig(config, axisFieldOptions.length > 0, () =>
    applyConfig({
      xFieldId: axisFieldOptions[0]?.id ?? '',
      yFieldId: axisFieldOptions[1]?.id ?? axisFieldOptions[0]?.id ?? '',
      sizeFieldId: null,
      colorFieldId: null,
      quadrants: DEFAULT_BUBBLE_QUADRANTS
    })
  );

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

  // The chart fills its container: measure it and size the plot area to match, so the drawing
  // is 1:1 with screen pixels (bubble radii and text keep their size instead of scaling).
  const [wrapSize, setWrapSize] = useState<{ width: number; height: number } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the wrapper only mounts once a config exists, so re-attach the observer when that changes
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setWrapSize(prev =>
        prev && prev.width === Math.round(width) && prev.height === Math.round(height)
          ? prev
          : { width: Math.round(width), height: Math.round(height) }
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [config]);
  const plotW = Math.max(
    MIN_PLOT_W,
    wrapSize ? wrapSize.width - MARGIN_LEFT - MARGIN_RIGHT : PLOT_W
  );
  const plotH = Math.max(
    MIN_PLOT_H,
    wrapSize ? wrapSize.height - MARGIN_TOP - MARGIN_BOTTOM : PLOT_H
  );
  const vbW = MARGIN_LEFT + plotW + MARGIN_RIGHT;
  const vbH = MARGIN_TOP + plotH + MARGIN_BOTTOM;

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
        colorMap,
        plotWidth: plotW,
        plotHeight: plotH
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
      colorMap,
      plotW,
      plotH
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
          <LabeledSelect
            label="X axis"
            value={config?.xFieldId ?? ''}
            onChange={value => config && applyConfig({ ...config, xFieldId: value })}
            disabled={axisFieldOptions.length === 0}
            options={
              axisFieldOptions.length === 0
                ? [{ value: '', label: '—' }]
                : axisFieldOptions.map(f => ({ value: f.id, label: f.label }))
            }
          />

          <LabeledSelect
            label="Y axis"
            value={config?.yFieldId ?? ''}
            onChange={value => config && applyConfig({ ...config, yFieldId: value })}
            disabled={axisFieldOptions.length === 0}
            options={
              axisFieldOptions.length === 0
                ? [{ value: '', label: '—' }]
                : axisFieldOptions.map(f => ({ value: f.id, label: f.label }))
            }
          />

          <LabeledSelect
            label="Size"
            value={config?.sizeFieldId ?? ''}
            onChange={value => config && applyConfig({ ...config, sizeFieldId: value || null })}
            disabled={!config || numericFields.length === 0}
            options={[
              { value: '', label: 'Uniform' },
              ...numericFields.map(f => ({ value: f.id, label: f.label }))
            ]}
          />

          <LabeledSelect
            label="Color"
            value={config?.colorFieldId ?? ''}
            onChange={value => config && applyConfig({ ...config, colorFieldId: value || null })}
            disabled={!config || categoricalFields.length === 0}
            options={[
              { value: '', label: 'Uniform' },
              ...categoricalFields.map(f => ({ value: f.id, label: f.label }))
            ]}
          />

          {hasMixedSchemas && <MixedSchemasWarning />}

          <div style={{ flex: 1 }} />

          <Popover.Root actionsRef={quadrantsActionsRef}>
            <Popover.Trigger
              element={
                <ToolbarButton
                  variant={config?.quadrants.enabled ? 'primary' : undefined}
                  disabled={!config}
                  icon={<TbGrid3X3 size={12} />}
                >
                  Quadrants
                </ToolbarButton>
              }
            />
            <Popover.Content
              side="bottom"
              sideOffset={4}
              align="end"
              arrow={false}
              closeButton={false}
              className={styles.quadrantsPopover}
            >
              <div className={styles.quadrantsHeader}>Quadrants</div>
              <label className={styles.quadrantsToggle}>
                <input
                  type="checkbox"
                  checked={config?.quadrants.enabled ?? false}
                  disabled={!config}
                  onChange={e =>
                    config &&
                    applyConfig({
                      ...config,
                      quadrants: { ...config.quadrants, enabled: e.target.checked }
                    })
                  }
                />
                Show quadrant dividers and labels
              </label>
              <div className={styles.quadrantsGrid}>
                <label className={styles.quadrantInput}>
                  <span>Top left</span>
                  <TextInput
                    value={config?.quadrants.labels.topLeft ?? ''}
                    disabled={!config}
                    onChange={value =>
                      config &&
                      applyConfig({
                        ...config,
                        quadrants: {
                          ...config.quadrants,
                          labels: { ...config.quadrants.labels, topLeft: value ?? '' }
                        }
                      })
                    }
                  />
                </label>
                <label className={styles.quadrantInput}>
                  <span>Top right</span>
                  <TextInput
                    value={config?.quadrants.labels.topRight ?? ''}
                    disabled={!config}
                    onChange={value =>
                      config &&
                      applyConfig({
                        ...config,
                        quadrants: {
                          ...config.quadrants,
                          labels: { ...config.quadrants.labels, topRight: value ?? '' }
                        }
                      })
                    }
                  />
                </label>
                <label className={styles.quadrantInput}>
                  <span>Bottom left</span>
                  <TextInput
                    value={config?.quadrants.labels.bottomLeft ?? ''}
                    disabled={!config}
                    onChange={value =>
                      config &&
                      applyConfig({
                        ...config,
                        quadrants: {
                          ...config.quadrants,
                          labels: { ...config.quadrants.labels, bottomLeft: value ?? '' }
                        }
                      })
                    }
                  />
                </label>
                <label className={styles.quadrantInput}>
                  <span>Bottom right</span>
                  <TextInput
                    value={config?.quadrants.labels.bottomRight ?? ''}
                    disabled={!config}
                    onChange={value =>
                      config &&
                      applyConfig({
                        ...config,
                        quadrants: {
                          ...config.quadrants,
                          labels: { ...config.quadrants.labels, bottomRight: value ?? '' }
                        }
                      })
                    }
                  />
                </label>
              </div>
            </Popover.Content>
          </Popover.Root>

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
            subtitle="Map fields to the X, Y, size and color axes above."
          />
        ) : (
          <div className={styles.body}>
            <div className={styles.svgWrap} ref={wrapRef} onMouseMove={onSvgMouseMove}>
              <svg
                className={styles.svg}
                width={vbW}
                height={vbH}
                viewBox={`0 0 ${vbW} ${vbH}`}
                overflow="visible"
              >
                {/* Axes */}
                <line
                  x1={MARGIN_LEFT}
                  y1={MARGIN_TOP + plotH}
                  x2={MARGIN_LEFT + plotW}
                  y2={MARGIN_TOP + plotH}
                  stroke="var(--panel-border)"
                  strokeWidth="1"
                />
                <line
                  x1={MARGIN_LEFT}
                  y1={MARGIN_TOP}
                  x2={MARGIN_LEFT}
                  y2={MARGIN_TOP + plotH}
                  stroke="var(--panel-border)"
                  strokeWidth="1"
                />
                <text
                  x={MARGIN_LEFT + plotW / 2}
                  y={vbH - 10}
                  textAnchor="middle"
                  style={{ fontSize: 11, fontWeight: 600, fill: 'var(--base-fg-more-dim)' }}
                >
                  {xLabel}
                </text>
                <text
                  x={14}
                  y={MARGIN_TOP + plotH / 2}
                  textAnchor="middle"
                  transform={`rotate(-90, 14, ${MARGIN_TOP + plotH / 2})`}
                  style={{ fontSize: 11, fontWeight: 600, fill: 'var(--base-fg-more-dim)' }}
                >
                  {yLabel}
                </text>

                {config.quadrants.enabled && (
                  <g className={styles.quadrantsOverlay}>
                    <line
                      x1={MARGIN_LEFT + plotW / 2}
                      y1={MARGIN_TOP}
                      x2={MARGIN_LEFT + plotW / 2}
                      y2={MARGIN_TOP + plotH}
                    />
                    <line
                      x1={MARGIN_LEFT}
                      y1={MARGIN_TOP + plotH / 2}
                      x2={MARGIN_LEFT + plotW}
                      y2={MARGIN_TOP + plotH / 2}
                    />
                    <text x={MARGIN_LEFT + 12} y={MARGIN_TOP + 18}>
                      {config.quadrants.labels.topLeft}
                    </text>
                    <text x={MARGIN_LEFT + plotW - 12} y={MARGIN_TOP + 18} textAnchor="end">
                      {config.quadrants.labels.topRight}
                    </text>
                    <text x={MARGIN_LEFT + 12} y={MARGIN_TOP + plotH - 12}>
                      {config.quadrants.labels.bottomLeft}
                    </text>
                    <text x={MARGIN_LEFT + plotW - 12} y={MARGIN_TOP + plotH - 12} textAnchor="end">
                      {config.quadrants.labels.bottomRight}
                    </text>
                  </g>
                )}

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
