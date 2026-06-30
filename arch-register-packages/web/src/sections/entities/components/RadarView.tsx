import { useState, useMemo, useRef, useCallback } from 'react';
import styles from './RadarView.module.css';
import { TbSettings, TbSearch, TbChevronUp, TbChevronDown } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { FormSection } from '@diagram-craft/app-components/FormSection';
import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { ApiSelectField, EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RadarConfig = {
  schemaId: string;
  quadrantFieldId: string;
  ringFieldId: string;
  ringOrder: string[];
};

type Quadrant = {
  value: string;
  label: string;
  startAngle: number;
  endAngle: number;
  color: string;
};

type Ring = {
  value: string;
  label: string;
  innerR: number;
  outerR: number;
  color: string;
};

type Blip = {
  id: string;
  name: string;
  description: string;
  quadrantValue: string;
  ringValue: string;
  num: number;
  x: number;
  y: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CX = 420;
const CY = 420;
const MAX_R = 385;

const QUADRANT_COLORS = [
  'var(--tag-api)',
  'var(--tag-component)',
  'var(--tag-database)',
  'var(--tag-system)',
  'var(--tag-service)',
  'var(--accent-fg)',
  'var(--warning-fg)',
  'oklch(0.62 0.14 180)'
];

const RING_COLORS = [
  'var(--tag-component)',
  'var(--accent-fg)',
  'var(--tag-system)',
  'var(--warning-fg)',
  'var(--tag-service)'
];

// Alternating backgrounds from inner (lighter) to outer (darker)
const RING_BG = [
  'var(--cmp-bg-hover)',
  'var(--cmp-bg)',
  'var(--panel-bg)',
  'var(--base-bg)',
  'oklch(0.12 0.005 260)'
];

const LIFECYCLE_FIELD_ID = '_lifecycle';

// ── Config helpers ────────────────────────────────────────────────────────────

const configKey = (workspaceSlug: string) => `ar-radar-config-${workspaceSlug}`;

const loadConfig = (workspaceSlug: string): RadarConfig | null => {
  try {
    const raw = localStorage.getItem(configKey(workspaceSlug));
    return raw ? (JSON.parse(raw) as RadarConfig) : null;
  } catch {
    return null;
  }
};

const saveConfig = (workspaceSlug: string, config: RadarConfig) => {
  localStorage.setItem(configKey(workspaceSlug), JSON.stringify(config));
};

// ── Field helpers ─────────────────────────────────────────────────────────────

type FieldOption = { id: string; label: string };

const getSelectableFields = (
  schema: EntitySchema,
  lifecycleStates: WorkspaceLifecycleState[]
): FieldOption[] => [
  ...schema.fields
    .filter((f): f is Extract<typeof f, { type: 'select' }> => f.type === 'select')
    .map(f => ({ id: f.id, label: f.name })),
  ...(lifecycleStates.length > 0 ? [{ id: LIFECYCLE_FIELD_ID, label: 'Lifecycle' }] : [])
];

const getFieldValues = (
  schema: EntitySchema,
  fieldId: string,
  lifecycleStates: WorkspaceLifecycleState[]
): Array<{ value: string; label: string }> => {
  if (fieldId === LIFECYCLE_FIELD_ID) {
    return [...lifecycleStates]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({ value: s.id, label: s.label }));
  }
  const field = schema.fields.find(f => f.id === fieldId);
  if (field?.type !== 'select') return [];
  return (field as ApiSelectField).options ?? [];
};

const getEntityFieldValue = (entity: EntityRecord, fieldId: string): string | null => {
  if (fieldId === LIFECYCLE_FIELD_ID) return entity._lifecycle?.id ?? null;
  const val = entity[fieldId];
  return typeof val === 'string' ? val : null;
};

// ── Geometry ──────────────────────────────────────────────────────────────────

function buildQuadrants(values: Array<{ value: string; label: string }>): Quadrant[] {
  const N = Math.min(values.length, 8);
  return values.slice(0, N).map((v, i) => ({
    value: v.value,
    label: v.label,
    startAngle: (i / N) * 2 * Math.PI - Math.PI / 2,
    endAngle: ((i + 1) / N) * 2 * Math.PI - Math.PI / 2,
    color: QUADRANT_COLORS[i % QUADRANT_COLORS.length]!
  }));
}

function buildRings(values: Array<{ value: string; label: string }>): Ring[] {
  const M = Math.min(values.length, 5);
  return values.slice(0, M).map((v, i) => ({
    value: v.value,
    label: v.label,
    innerR: (i / M) * MAX_R,
    outerR: ((i + 1) / M) * MAX_R,
    color: RING_COLORS[i % RING_COLORS.length]!
  }));
}

// Deterministic hash for stable blip placement
function rHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function getBlipXY(entityId: string, quad: Quadrant, ring: Ring): { x: number; y: number } {
  const h1 = rHash(`${entityId}~a`);
  const h2 = rHash(`${entityId}~b`);
  const aSpread = (quad.endAngle - quad.startAngle) * 0.78;
  const angle =
    quad.startAngle + (quad.endAngle - quad.startAngle) * 0.11 + ((h1 % 9973) / 9973) * aSpread;
  const rMin = ring.innerR < 10 ? 14 : ring.innerR + 10;
  const rMax = ring.outerR - 10;
  const r = rMin + ((h2 % 9871) / 9871) * (rMax - rMin);
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function buildBlips(
  entities: EntityRecord[],
  quadrantFieldId: string,
  ringFieldId: string,
  quadrants: Quadrant[],
  rings: Ring[]
): Blip[] {
  const quadMap = new Map(quadrants.map(q => [q.value, q]));
  const ringMap = new Map(rings.map(r => [r.value, r]));

  const valid = entities.filter(e => {
    const qv = getEntityFieldValue(e, quadrantFieldId);
    const rv = getEntityFieldValue(e, ringFieldId);
    return qv != null && rv != null && quadMap.has(qv) && ringMap.has(rv);
  });

  const quadIdx = new Map(quadrants.map((q, i) => [q.value, i]));
  const ringIdx = new Map(rings.map((r, i) => [r.value, i]));

  valid.sort((a, b) => {
    const qa = quadIdx.get(getEntityFieldValue(a, quadrantFieldId)!) ?? 0;
    const qb = quadIdx.get(getEntityFieldValue(b, quadrantFieldId)!) ?? 0;
    if (qa !== qb) return qa - qb;
    const ra = ringIdx.get(getEntityFieldValue(a, ringFieldId)!) ?? 0;
    const rb = ringIdx.get(getEntityFieldValue(b, ringFieldId)!) ?? 0;
    if (ra !== rb) return ra - rb;
    return (a._name ?? '').localeCompare(b._name ?? '');
  });

  return valid.map((e, i) => {
    const qv = getEntityFieldValue(e, quadrantFieldId)!;
    const rv = getEntityFieldValue(e, ringFieldId)!;
    const quad = quadMap.get(qv)!;
    const ring = ringMap.get(rv)!;
    return {
      id: e._uid,
      name: e._name ?? e._slug,
      description: e._description ?? '',
      quadrantValue: qv,
      ringValue: rv,
      num: i + 1,
      ...getBlipXY(e._uid, quad, ring)
    };
  });
}

// ── RadarView ─────────────────────────────────────────────────────────────────

export const RadarView = ({
  rows,
  linkedEntityIds,
  onEntityClick,
  config: configProp,
  onConfigChange
}: EntityBrowserRowViewProps & {
  config?: RadarConfig | null;
  onConfigChange?: (config: RadarConfig) => void;
}) => {
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const [internalConfig, setInternalConfig] = useState<RadarConfig | null>(() =>
    loadConfig(workspaceSlug)
  );
  const config = configProp ?? internalConfig;

  const [showSettings, setShowSettings] = useState(false);
  const [q, setQ] = useState('');
  const [quadFilter, setQuadFilter] = useState<string | null>(null);
  const [ringFilter, setRingFilter] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);
  const entities = rows;

  const schema = config ? (schemas.find(s => s.id === config.schemaId) ?? null) : null;

  const quadrantValues = useMemo(() => {
    if (!config || !schema) return [];
    return getFieldValues(schema, config.quadrantFieldId, lifecycleStates);
  }, [config, schema, lifecycleStates]);

  const ringValues = useMemo(() => {
    if (!config || !schema) return [];
    const all = getFieldValues(schema, config.ringFieldId, lifecycleStates);
    if (config.ringOrder.length === 0) return all.slice(0, 5);
    const ordered: Array<{ value: string; label: string }> = [];
    for (const v of config.ringOrder) {
      const found = all.find(av => av.value === v);
      if (found) ordered.push(found);
    }
    return ordered;
  }, [config, schema, lifecycleStates]);

  const quadrants = useMemo(() => buildQuadrants(quadrantValues), [quadrantValues]);
  const rings = useMemo(() => buildRings(ringValues), [ringValues]);

  const allBlips = useMemo(() => {
    if (!config) return [];
    return buildBlips(entities, config.quadrantFieldId, config.ringFieldId, quadrants, rings);
  }, [entities, config, quadrants, rings]);

  const blips = useMemo(() => {
    let xs = allBlips;
    if (quadFilter) xs = xs.filter(b => b.quadrantValue === quadFilter);
    if (ringFilter) xs = xs.filter(b => b.ringValue === ringFilter);
    if (q)
      xs = xs.filter(
        b =>
          b.name.toLowerCase().includes(q.toLowerCase()) ||
          b.description.toLowerCase().includes(q.toLowerCase())
      );
    return xs;
  }, [allBlips, quadFilter, ringFilter, q]);

  const activeId = pinned ?? hovered;
  const activeBlip = useMemo(
    () => (activeId ? (allBlips.find(b => b.id === activeId) ?? null) : null),
    [activeId, allBlips]
  );
  const activeQuad = useMemo(
    () => (activeBlip ? (quadrants.find(q => q.value === activeBlip.quadrantValue) ?? null) : null),
    [activeBlip, quadrants]
  );
  const activeRing = useMemo(
    () => (activeBlip ? (rings.find(r => r.value === activeBlip.ringValue) ?? null) : null),
    [activeBlip, rings]
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

  const onBlipClick = (id: string) => setPinned(p => (p === id ? null : id));

  const handleSaveConfig = (newConfig: RadarConfig) => {
    if (onConfigChange) {
      onConfigChange(newConfig);
    } else {
      saveConfig(workspaceSlug, newConfig);
      setInternalConfig(newConfig);
    }
    setShowSettings(false);
    setQuadFilter(null);
    setRingFilter(null);
    setQ('');
    setPinned(null);
    setHovered(null);
  };

  const now = new Date();
  const edition = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Technology Radar</div>
          <div className={styles.titleRow}>
            <div className={styles.title}>
              {schema ? `${schema.name} Radar` : 'Technology Radar'}
            </div>
            <span className={styles.edition}>{edition}</span>
          </div>
          <div className={styles.sub}>
            {config && allBlips.length > 0
              ? `${allBlips.length} entries · ${rings.map(r => r.label).join(' · ')}`
              : 'Visualise the technology landscape across entities.'}
          </div>
        </div>
        <div className={styles.actions}>
          <Button icon={<TbSettings size={12} />} onClick={() => setShowSettings(true)}>
            Configure
          </Button>
        </div>
      </div>

      {!config ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Radar not configured</div>
          <div>
            Click <b>Configure</b> to map a schema and fields to the radar axes.
          </div>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchInline}>
              <TbSearch size={12} />
              <input placeholder="Find an entry…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className={styles.pills}>
              {rings.map(ring => (
                <button
                  key={ring.value}
                  type="button"
                  className={`${styles.pill}${ringFilter === ring.value ? ` ${styles.pillActive}` : ''}`}
                  onClick={() => setRingFilter(r => (r === ring.value ? null : ring.value))}
                >
                  {ring.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <span className={styles.pillsLabel}>Quadrant</span>
            <div className={styles.pills}>
              {quadrants.map(quad => (
                <button
                  key={quad.value}
                  type="button"
                  className={`${styles.pill}${quadFilter === quad.value ? ` ${styles.pillActive}` : ''}`}
                  onClick={() => setQuadFilter(p => (p === quad.value ? null : quad.value))}
                >
                  <span className={styles.pillDot} style={{ background: quad.color }} />
                  {quad.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.body}>
            <div className={styles.svgWrap} ref={wrapRef} onMouseMove={onSvgMouseMove}>
              <svg
                className={styles.svg}
                viewBox="0 0 840 840"
                preserveAspectRatio="xMidYMid meet"
                overflow="visible"
              >
                <RadarGrid quadrants={quadrants} rings={rings} dimmedQuad={quadFilter} />
                {blips.map(blip => {
                  const quad = quadrants.find(qq => qq.value === blip.quadrantValue);
                  return (
                    <RadarBlip
                      key={blip.id}
                      blip={blip}
                      color={quad?.color ?? 'var(--base-fg-more-dim)'}
                      isHovered={activeId === blip.id}
                      isDimmed={!!activeId && activeId !== blip.id}
                      onClick={() => onBlipClick(blip.id)}
                      onMouseEnter={() => {
                        if (!pinned) setHovered(blip.id);
                      }}
                      onMouseLeave={() => {
                        if (!pinned) setHovered(null);
                      }}
                    />
                  );
                })}
              </svg>
              {activeBlip && activeQuad && activeRing && (
                <BlipTooltip
                  blip={activeBlip}
                  quad={activeQuad}
                  ring={activeRing}
                  isLinked={linkedEntityIds == null || linkedEntityIdSet.has(activeBlip.id)}
                  x={tipPos.x}
                  y={tipPos.y}
                  pinned={pinned === activeBlip.id}
                  onDismiss={() => {
                    setPinned(null);
                    setHovered(null);
                  }}
                  onOpen={() => onEntityClick(activeBlip.id)}
                />
              )}
            </div>

            <div className={styles.legend}>
              <div className={styles.legendHead}>
                <span>Blip index</span>
                <span className={styles.legendCount}>{blips.length} shown</span>
              </div>
              <div className={styles.legendScroll}>
                {quadrants.map(quad => {
                  const qs = blips.filter(b => b.quadrantValue === quad.value);
                  if (qs.length === 0) return null;
                  return (
                    <div key={quad.value} className={styles.legendSection}>
                      <div className={styles.legendQuad}>
                        <span className={styles.legendQuadDot} style={{ background: quad.color }} />
                        {quad.label}
                      </div>
                      {qs.map(blip => {
                        const ring = rings.find(r => r.value === blip.ringValue);
                        return (
                          <LegendRow
                            key={blip.id}
                            blip={blip}
                            quadColor={quad.color}
                            ringLabel={ring?.label ?? blip.ringValue}
                            ringColor={ring?.color ?? 'var(--base-fg-more-dim)'}
                            isLinked={linkedEntityIds == null || linkedEntityIdSet.has(blip.id)}
                            active={activeId === blip.id}
                            onMouseEnter={() => {
                              if (!pinned) setHovered(blip.id);
                            }}
                            onMouseLeave={() => {
                              if (!pinned) setHovered(null);
                            }}
                            onClick={() => onBlipClick(blip.id)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {showSettings && (
        <RadarSettings
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          initialConfig={config}
          onSave={handleSaveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

// ── RadarGrid ─────────────────────────────────────────────────────────────────

const RadarGrid = ({
  quadrants,
  rings,
  dimmedQuad
}: {
  quadrants: Quadrant[];
  rings: Ring[];
  dimmedQuad: string | null;
}) => {
  const dimStyle: React.CSSProperties = { fill: 'var(--base-bg)', opacity: 0.55 };

  return (
    <g>
      {/* Ring fills — outermost first so inner circles cover */}
      {[...rings].reverse().map((ring, i) => (
        <circle
          key={`f${ring.value}`}
          cx={CX}
          cy={CY}
          r={ring.outerR}
          fill={RING_BG[(rings.length - 1 - i) % RING_BG.length]}
        />
      ))}

      {/* Dim non-selected quadrants */}
      {dimmedQuad &&
        quadrants
          .filter(q => q.value !== dimmedQuad)
          .map(quad => {
            const r = MAX_R;
            const x1 = CX + r * Math.cos(quad.startAngle);
            const y1 = CY + r * Math.sin(quad.startAngle);
            const x2 = CX + r * Math.cos(quad.endAngle);
            const y2 = CY + r * Math.sin(quad.endAngle);
            const sweep = quad.endAngle - quad.startAngle > Math.PI ? 1 : 0;
            return (
              <path
                key={quad.value}
                d={`M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${sweep} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
                style={dimStyle}
              />
            );
          })}

      {/* Ring borders */}
      {rings.map(ring => (
        <circle
          key={`b${ring.value}`}
          cx={CX}
          cy={CY}
          r={ring.outerR}
          fill="none"
          stroke="var(--panel-border)"
          strokeWidth="0.6"
        />
      ))}

      {/* Quadrant dividers */}
      {quadrants.map(quad => {
        const x = CX + (MAX_R + 3) * Math.cos(quad.startAngle);
        const y = CY + (MAX_R + 3) * Math.sin(quad.startAngle);
        return (
          <line
            key={`div${quad.value}`}
            x1={CX}
            y1={CY}
            x2={x.toFixed(1)}
            y2={y.toFixed(1)}
            stroke="var(--panel-border)"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Centre dot */}
      <circle cx={CX} cy={CY} r={3} fill="var(--panel-border)" />

      {/* Ring labels — one per ring, placed along the top divider line */}
      {rings.map(ring => {
        const mid = (ring.innerR + ring.outerR) / 2;
        const lx = CX + 12;
        const ly = CY - mid;
        return (
          <text
            key={`rl${ring.value}`}
            x={lx.toFixed(1)}
            y={ly.toFixed(1)}
            dominantBaseline="central"
            style={
              {
                fontSize: 9,
                fill: 'var(--base-fg-more-dim)',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                pointerEvents: 'none',
                userSelect: 'none'
              } as React.CSSProperties
            }
          >
            {ring.label.toUpperCase()}
          </text>
        );
      })}

      {/* Quadrant labels at edge of each sector */}
      {quadrants.map(quad => {
        const midAngle = (quad.startAngle + quad.endAngle) / 2;
        const lx = CX + (MAX_R + 22) * Math.cos(midAngle);
        const ly = CY + (MAX_R + 22) * Math.sin(midAngle);
        const cosMid = Math.cos(midAngle);
        const anchor: React.SVGAttributes<SVGTextElement>['textAnchor'] =
          Math.abs(cosMid) < 0.15 ? 'middle' : cosMid > 0 ? 'start' : 'end';
        return (
          <text
            key={`ql${quad.value}`}
            x={lx.toFixed(1)}
            y={ly.toFixed(1)}
            textAnchor={anchor}
            dominantBaseline="central"
            style={{
              fontSize: 10,
              fontWeight: 600,
              fill: quad.color,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            {quad.label}
          </text>
        );
      })}
    </g>
  );
};

// ── RadarBlip ─────────────────────────────────────────────────────────────────

const RadarBlip = ({
  blip,
  color,
  isHovered,
  isDimmed,
  onClick,
  onMouseEnter,
  onMouseLeave
}: {
  blip: Blip;
  color: string;
  isHovered: boolean;
  isDimmed: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => {
  return (
    <g
      transform={`translate(${blip.x.toFixed(1)},${blip.y.toFixed(1)})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer', opacity: isDimmed ? 0.2 : 1, transition: 'opacity 0.15s' }}
    >
      {isHovered && <circle r={14} fill="none" stroke={color} strokeWidth="1.5" opacity="0.55" />}
      <circle r={9} fill={color} />
      <circle r={9} fill="black" opacity="0.22" />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        dy="0.5"
        style={{
          fontSize: 7.5,
          fontWeight: 600,
          fill: 'white',
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'var(--font-mono)'
        }}
      >
        {blip.num}
      </text>
    </g>
  );
};

// ── BlipTooltip ───────────────────────────────────────────────────────────────

const BlipTooltip = ({
  blip,
  quad,
  ring,
  isLinked,
  x,
  y,
  pinned,
  onDismiss,
  onOpen
}: {
  blip: Blip;
  quad: Quadrant;
  ring: Ring;
  isLinked: boolean;
  x: number;
  y: number;
  pinned: boolean;
  onDismiss: () => void;
  onOpen: () => void;
}) => {
  return (
    <div
      className={`${styles.tooltip}${pinned ? ` ${styles.tooltipPinned}` : ''}`}
      style={{ left: x, top: y }}
    >
      <div className={styles.tooltipHead}>
        <span className={styles.tooltipNum} style={{ background: quad.color }}>
          {blip.num}
        </span>
        <span
          className={styles.tooltipName}
          style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
        >
          {blip.name}
        </span>
        {pinned && (
          <button type="button" className={styles.tooltipClose} onClick={onDismiss}>
            ✕
          </button>
        )}
      </div>
      <div className={styles.tooltipChips}>
        <span className={styles.tooltipChip} style={{ borderColor: quad.color, color: quad.color }}>
          {quad.label}
        </span>
        <span className={styles.tooltipChip} style={{ color: ring.color }}>
          {ring.label}
        </span>
      </div>
      {blip.description && <div className={styles.tooltipDesc}>{blip.description}</div>}
      <button type="button" className={styles.tooltipOpen} onClick={onOpen}>
        Open entity →
      </button>
      {pinned && <div className={styles.tooltipHint}>Click blip again to dismiss</div>}
    </div>
  );
};

// ── LegendRow ─────────────────────────────────────────────────────────────────

const LegendRow = ({
  blip,
  quadColor,
  ringLabel,
  ringColor,
  isLinked,
  active,
  onMouseEnter,
  onMouseLeave,
  onClick
}: {
  blip: Blip;
  quadColor: string;
  ringLabel: string;
  ringColor: string;
  isLinked: boolean;
  active: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      className={`${styles.legendRow}${active ? ` ${styles.legendRowActive}` : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <span className={styles.legendRowNum} style={{ background: quadColor }}>
        {blip.num}
      </span>
      <span
        className={styles.legendRowName}
        style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
      >
        {blip.name}
      </span>
      <span className={styles.legendRowRing} style={{ color: ringColor }}>
        {ringLabel}
      </span>
    </button>
  );
};

// ── RadarSettings ─────────────────────────────────────────────────────────────

const RadarSettings = ({
  schemas,
  lifecycleStates,
  initialConfig,
  onSave,
  onClose
}: {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  initialConfig: RadarConfig | null;
  onSave: (config: RadarConfig) => void;
  onClose: () => void;
}) => {
  const firstSchemaId = schemas[0]?.id ?? '';
  const [schemaId, setSchemaId] = useState(initialConfig?.schemaId ?? firstSchemaId);
  const [quadrantFieldId, setQuadrantFieldId] = useState(initialConfig?.quadrantFieldId ?? '');
  const [ringFieldId, setRingFieldId] = useState(initialConfig?.ringFieldId ?? '');
  const [ringOrder, setRingOrder] = useState<string[]>(initialConfig?.ringOrder ?? []);

  const selectedSchema = schemas.find(s => s.id === schemaId) ?? null;

  const fieldOptions = useMemo(
    () => (selectedSchema ? getSelectableFields(selectedSchema, lifecycleStates) : []),
    [selectedSchema, lifecycleStates]
  );

  // When schema changes, reset field selections if they're no longer valid
  const handleSchemaChange = (newSchemaId: string) => {
    const newSchema = schemas.find(s => s.id === newSchemaId);
    if (!newSchema) return;
    const opts = getSelectableFields(newSchema, lifecycleStates);
    setSchemaId(newSchemaId);
    const firstId = opts[0]?.id ?? '';
    const secondId = opts[1]?.id ?? firstId;
    setQuadrantFieldId(firstId);
    setRingFieldId(secondId);
    setRingOrder([]);
  };

  const handleRingFieldChange = (fieldId: string) => {
    setRingFieldId(fieldId);
    setRingOrder([]);
  };

  const ringFieldValues = useMemo(() => {
    if (!selectedSchema || !ringFieldId) return [];
    return getFieldValues(selectedSchema, ringFieldId, lifecycleStates);
  }, [selectedSchema, ringFieldId, lifecycleStates]);

  // Default to all values (up to 5) when ringOrder is empty so old configs still render
  const effectiveOrder = useMemo(() => {
    const valid = ringOrder.filter(v => ringFieldValues.some(rv => rv.value === v));
    if (valid.length > 0) return valid;
    return ringFieldValues.slice(0, 5).map(v => v.value);
  }, [ringOrder, ringFieldValues]);

  const moveRing = (idx: number, dir: -1 | 1) => {
    const next = [...effectiveOrder];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
    setRingOrder(next);
  };

  const toggleRing = (value: string) => {
    if (effectiveOrder.includes(value)) {
      setRingOrder(effectiveOrder.filter(v => v !== value));
    } else if (effectiveOrder.length < 5) {
      setRingOrder([...effectiveOrder, value]);
    }
  };

  // Ensure field selections are valid (e.g. if fieldOptions changed but state has stale values)
  const effectiveQuadrantFieldId = fieldOptions.some(f => f.id === quadrantFieldId)
    ? quadrantFieldId
    : (fieldOptions[0]?.id ?? '');
  const effectiveRingFieldId = fieldOptions.some(f => f.id === ringFieldId)
    ? ringFieldId
    : (fieldOptions[1]?.id ?? fieldOptions[0]?.id ?? '');

  const displayRings = useMemo(() => {
    const checked = ringFieldValues
      .filter(rv => effectiveOrder.includes(rv.value))
      .sort((a, b) => effectiveOrder.indexOf(a.value) - effectiveOrder.indexOf(b.value));
    const unchecked = ringFieldValues.filter(rv => !effectiveOrder.includes(rv.value));
    return [...checked, ...unchecked];
  }, [ringFieldValues, effectiveOrder]);

  const canSave = !!schemaId && !!effectiveQuadrantFieldId && !!effectiveRingFieldId;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      schemaId,
      quadrantFieldId: effectiveQuadrantFieldId,
      ringFieldId: effectiveRingFieldId,
      ringOrder: effectiveOrder
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      sup="Entity browser · Radar view"
      title="Radar Configuration"
      sub="Map an entity schema to the radar quadrants and rings. No schema changes required — the radar is a convention-based rendering of existing entities."
      width="min(560px, calc(100vw - 48px))"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        { label: 'Save configuration', type: 'default', disabled: !canSave, onClick: handleSave }
      ]}
    >
      <div className={styles.settingsBody}>
        {/* Step 1: Data source */}
        <FormSection step={1} title="Data source">
          <div className={styles.settingsRow}>
            <FormElement label="Entity schema" style={{ flex: 1 }}>
              <Select.Root
                value={schemaId || undefined}
                onChange={value => handleSchemaChange(value ?? '')}
                style={{ width: '100%' }}
              >
                {schemas.map(s => (
                  <Select.Item key={s.id} value={s.id}>
                    {s.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
            <FormElement label="Quadrant field" style={{ flex: 1 }}>
              <Select.Root
                value={effectiveQuadrantFieldId || undefined}
                onChange={value => setQuadrantFieldId(value ?? '')}
                placeholder={
                  fieldOptions.length === 0 ? 'No select or lifecycle fields' : undefined
                }
                style={{ width: '100%' }}
                disabled={fieldOptions.length === 0}
              >
                {fieldOptions.map(f => (
                  <Select.Item key={f.id} value={f.id}>
                    {f.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          </div>
          <div className={styles.settingsRow}>
            <FormElement label="Ring field" style={{ flex: 1 }}>
              <Select.Root
                value={effectiveRingFieldId || undefined}
                onChange={value => handleRingFieldChange(value ?? '')}
                placeholder={
                  fieldOptions.length === 0 ? 'No select or lifecycle fields' : undefined
                }
                style={{ width: '100%' }}
                disabled={fieldOptions.length === 0}
              >
                {fieldOptions.map(f => (
                  <Select.Item key={f.id} value={f.id}>
                    {f.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          </div>
          {fieldOptions.length === 0 && (
            <div className={styles.settingsNote}>
              The selected schema has no Select fields and there are no lifecycle states. Add a
              Select field or configure lifecycle states to use the radar.
            </div>
          )}
        </FormSection>

        {/* Step 2: Ring ordering */}
        <FormSection step={2} title="Ring order">
          {ringFieldValues.length === 0 ? (
            <div className={styles.settingsNote}>
              Select a ring field above to configure the ring order.
            </div>
          ) : (
            <div className={styles.ringOrderList}>
              {displayRings.map(rv => {
                const orderIdx = effectiveOrder.indexOf(rv.value);
                const checked = orderIdx !== -1;
                const disabledCheck = !checked && effectiveOrder.length >= 5;
                const color = checked ? RING_COLORS[orderIdx % RING_COLORS.length]! : undefined;
                return (
                  <div
                    key={rv.value}
                    className={`${styles.ringOrderRow}${checked ? ` ${styles.ringOrderRowChecked}` : ''}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.ringOrderCheck}
                      checked={checked}
                      disabled={disabledCheck}
                      onChange={() => toggleRing(rv.value)}
                    />
                    <span
                      className={styles.ringOrderDot}
                      style={
                        color
                          ? { background: color }
                          : { border: '1px solid var(--base-fg-more-dim)' }
                      }
                    />
                    <span className={styles.ringOrderLabel}>{rv.label}</span>
                    {checked && (
                      <>
                        <span className={styles.ringOrderIdx}>
                          {orderIdx === 0
                            ? 'innermost'
                            : orderIdx === effectiveOrder.length - 1
                              ? 'outermost'
                              : ''}
                        </span>
                        <div className={styles.ringOrderBtns}>
                          <button
                            type="button"
                            className={styles.ringOrderBtn}
                            onClick={() => moveRing(orderIdx, -1)}
                            disabled={orderIdx === 0}
                            title="Move inward"
                          >
                            <TbChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            className={styles.ringOrderBtn}
                            onClick={() => moveRing(orderIdx, 1)}
                            disabled={orderIdx >= effectiveOrder.length - 1}
                            title="Move outward"
                          >
                            <TbChevronDown size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {effectiveOrder.length >= 5 &&
                ringFieldValues.some(rv => !effectiveOrder.includes(rv.value)) && (
                  <div className={styles.settingsNote}>
                    Maximum 5 rings reached. Uncheck a value to select a different one.
                  </div>
                )}
            </div>
          )}
        </FormSection>
      </div>
    </Dialog>
  );
};
