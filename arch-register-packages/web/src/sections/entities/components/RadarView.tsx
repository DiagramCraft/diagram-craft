import { useState, useMemo, useRef, useCallback } from 'react';
import styles from './RadarView.module.css';
import { TbChevronUp, TbChevronDown } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover } from '@diagram-craft/app-components/Popover';
import { EmptyState } from '../../../components/EmptyState';
import { SearchInput } from '../../../components/SearchInput';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntities } from '../../../hooks/useEntities';
import { radarViewConfigSchema } from '@arch-register/api-types/viewContract';
import { ApiSelectField, EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { EntityRecord } from '@arch-register/api-types/entityContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { ASSESSMENT_FIELD_PREFIX, resolveAssessmentValue } from '@arch-register/api-types/assessmentFilter';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import type { BrowserEntityRecord } from './entityBrowserState';

export type JoinedAssessmentContext = { assessment: Assessment; enums: WorkspaceEnum[] };

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

const RATING_VALUES = ['1', '2', '3', '4', '5'].map(v => ({ value: v, label: v }));

const getSelectableFields = (
  schema: EntitySchema,
  lifecycleStates: WorkspaceLifecycleState[],
  joinedAssessment?: JoinedAssessmentContext | null
): FieldOption[] => [
  ...schema.fields
    .filter((f): f is Extract<typeof f, { type: 'select' }> => f.type === 'select')
    .map(f => ({ id: f.id, label: f.name })),
  ...(lifecycleStates.length > 0 ? [{ id: LIFECYCLE_FIELD_ID, label: 'Lifecycle' }] : []),
  ...(joinedAssessment
    ? joinedAssessment.assessment.fields
        .filter(f => f.type === 'rating' || f.type === 'enum')
        .map(f => ({ id: `${ASSESSMENT_FIELD_PREFIX}${f.id}`, label: f.label }))
    : [])
];

const getFieldValues = (
  schema: EntitySchema,
  fieldId: string,
  lifecycleStates: WorkspaceLifecycleState[],
  joinedAssessment?: JoinedAssessmentContext | null
): Array<{ value: string; label: string }> => {
  if (fieldId === LIFECYCLE_FIELD_ID) {
    return [...lifecycleStates]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({ value: s.id, label: s.label }));
  }
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX) && joinedAssessment) {
    const assessmentFieldId = fieldId.slice(ASSESSMENT_FIELD_PREFIX.length);
    const field = joinedAssessment.assessment.fields.find(f => f.id === assessmentFieldId);
    if (field?.type === 'rating') return RATING_VALUES;
    if (field?.type === 'enum') {
      return joinedAssessment.enums.find(e => e.id === field.enumId)?.options ?? [];
    }
    return [];
  }
  const field = schema.fields.find(f => f.id === fieldId);
  if (field?.type !== 'select') return [];
  return (field as ApiSelectField).options ?? [];
};

const getEntityFieldValue = (entity: EntityRecord, fieldId: string): string | null => {
  if (fieldId === LIFECYCLE_FIELD_ID) return entity._lifecycle?.id ?? null;
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)) {
    const value = resolveAssessmentValue(entity as BrowserEntityRecord, fieldId);
    return value == null ? null : String(value);
  }
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
  onConfigChange,
  hideToolbar,
  joinedAssessment
}: EntityBrowserRowViewProps & {
  config?: unknown;
  onConfigChange?: (config: RadarConfig) => void;
  hideToolbar?: boolean;
  joinedAssessment?: JoinedAssessmentContext | null;
}) => {
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const [internalConfig, setInternalConfig] = useState<RadarConfig | null>(() =>
    loadConfig(workspaceSlug)
  );
  const parsedConfig = useMemo(() => {
    const result = radarViewConfigSchema.safeParse(configProp);
    return result.success ? result.data : null;
  }, [configProp]);
  const config = parsedConfig ?? internalConfig;

  const [ringOrderOpen, setRingOrderOpen] = useState(false);
  const [q, setQ] = useState('');
  const [quadFilter, setQuadFilter] = useState<string | null>(null);
  const [ringFilter, setRingFilter] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  // Rows arrive in 'summary' view (no custom select field values), but the quadrant/ring
  // axes are often custom Select fields — fetch the full-view records for the radar's
  // schema and use those in place of the summary rows wherever available.
  const { data: fullSchemaEntities = [] } = useEntities(
    workspaceSlug,
    { schemaId: config?.schemaId, view: 'full' },
    { enabled: !!workspaceSlug && !!config?.schemaId }
  );
  const fullEntityMap = useMemo(() => {
    const m = new Map<string, EntityRecord>();
    fullSchemaEntities.forEach(e => m.set(e._uid, e));
    return m;
  }, [fullSchemaEntities]);
  const entities = useMemo(
    () =>
      rows.map(r => {
        const full = fullEntityMap.get(r._uid);
        return full ? ({ ...full, _assessment: r._assessment } as BrowserEntityRecord) : r;
      }),
    [rows, fullEntityMap]
  );

  const schema = config ? (schemas.find(s => s.id === config.schemaId) ?? null) : null;

  const fieldOptions = useMemo(
    () => (schema ? getSelectableFields(schema, lifecycleStates, joinedAssessment) : []),
    [schema, lifecycleStates, joinedAssessment]
  );

  const quadrantValues = useMemo(() => {
    if (!config || !schema) return [];
    return getFieldValues(schema, config.quadrantFieldId, lifecycleStates, joinedAssessment);
  }, [config, schema, lifecycleStates, joinedAssessment]);

  const ringValues = useMemo(() => {
    if (!config || !schema) return [];
    const all = getFieldValues(schema, config.ringFieldId, lifecycleStates, joinedAssessment);
    if (config.ringOrder.length === 0) return all.slice(0, 5);
    const ordered: Array<{ value: string; label: string }> = [];
    for (const v of config.ringOrder) {
      const found = all.find(av => av.value === v);
      if (found) ordered.push(found);
    }
    return ordered;
  }, [config, schema, lifecycleStates, joinedAssessment]);

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

  const applyConfig = (newConfig: RadarConfig) => {
    if (onConfigChange) {
      onConfigChange(newConfig);
    } else {
      saveConfig(workspaceSlug, newConfig);
      setInternalConfig(newConfig);
    }
    setQuadFilter(null);
    setRingFilter(null);
    setQ('');
    setPinned(null);
    setHovered(null);
  };

  const handleSchemaChange = (newSchemaId: string) => {
    const newSchema = schemas.find(s => s.id === newSchemaId);
    if (!newSchema) return;
    const opts = getSelectableFields(newSchema, lifecycleStates, joinedAssessment);
    const quadrantFieldId = opts[0]?.id ?? '';
    const ringFieldId = opts[1]?.id ?? quadrantFieldId;
    applyConfig({ schemaId: newSchemaId, quadrantFieldId, ringFieldId, ringOrder: [] });
  };

  const handleQuadrantFieldChange = (newQuadrantFieldId: string) => {
    if (!config) return;
    applyConfig({ ...config, quadrantFieldId: newQuadrantFieldId });
  };

  const handleRingFieldChange = (newRingFieldId: string) => {
    if (!config) return;
    applyConfig({ ...config, ringFieldId: newRingFieldId, ringOrder: [] });
  };

  const ringFieldAllValues = useMemo(() => {
    if (!schema || !config) return [];
    return getFieldValues(schema, config.ringFieldId, lifecycleStates, joinedAssessment);
  }, [schema, config, lifecycleStates, joinedAssessment]);

  const ringOrderDisplay = useMemo(() => {
    const checkedSet = new Set(ringValues.map(v => v.value));
    return [...ringValues, ...ringFieldAllValues.filter(v => !checkedSet.has(v.value))];
  }, [ringValues, ringFieldAllValues]);

  const toggleRing = (value: string) => {
    if (!config) return;
    const order = ringValues.map(v => v.value);
    if (order.includes(value)) {
      applyConfig({ ...config, ringOrder: order.filter(v => v !== value) });
    } else if (order.length < 5) {
      applyConfig({ ...config, ringOrder: [...order, value] });
    }
  };

  const moveRing = (idx: number, dir: -1 | 1) => {
    if (!config) return;
    const order = ringValues.map(v => v.value);
    const next = [...order];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
    applyConfig({ ...config, ringOrder: next });
  };

  const now = new Date();
  const edition = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.screen}>
      {!hideToolbar && (
        <div className={styles.config}>
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Schema</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.schemaId ?? ''}
                onChange={e => handleSchemaChange(e.target.value)}
              >
                <option value="" disabled>
                  — select —
                </option>
                {schemas.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Quadrant</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.quadrantFieldId ?? ''}
                disabled={!schema || fieldOptions.length === 0}
                onChange={e => handleQuadrantFieldChange(e.target.value)}
              >
                {fieldOptions.length === 0 && <option value="">—</option>}
                {fieldOptions.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Ring</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={config?.ringFieldId ?? ''}
                disabled={!schema || fieldOptions.length === 0}
                onChange={e => handleRingFieldChange(e.target.value)}
              >
                {fieldOptions.length === 0 && <option value="">—</option>}
                {fieldOptions.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          {schema && fieldOptions.length === 0 && (
            <span className={styles.noFields}>
              No Select fields or lifecycle states on this schema.
            </span>
          )}

          <div style={{ flex: 1 }} />

          <Popover.Root open={ringOrderOpen} onOpenChange={setRingOrderOpen}>
            <Popover.Trigger
              element={
                <Button size="sm" disabled={!config} iconRight={<TbChevronDown size={11} />}>
                  Ring order
                </Button>
              }
            />
            <Popover.Content side="bottom" align="end" className={styles.ringOrderPopover}>
              {ringOrderDisplay.length === 0 ? (
                <div className={styles.settingsNote}>
                  Select a ring field above to configure the ring order.
                </div>
              ) : (
                <div className={styles.ringOrderList}>
                  {ringOrderDisplay.map(rv => {
                    const order = ringValues.map(v => v.value);
                    const orderIdx = order.indexOf(rv.value);
                    const checked = orderIdx !== -1;
                    const disabledCheck = !checked && order.length >= 5;
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
                              disabled={orderIdx >= order.length - 1}
                              title="Move outward"
                            >
                              <TbChevronDown size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {ringValues.length >= 5 &&
                    ringFieldAllValues.some(
                      rv => !ringValues.some(cv => cv.value === rv.value)
                    ) && (
                      <div className={styles.settingsNote}>
                        Maximum 5 rings reached. Uncheck a value to select a different one.
                      </div>
                    )}
                </div>
              )}
            </Popover.Content>
          </Popover.Root>
        </div>
      )}

      <div className={styles.content}>
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
        </div>

        {!config ? (
          <EmptyState
            title="Radar not configured"
            subtitle="Choose a schema above to map a schema and fields to the radar axes."
          />
        ) : (
          <>
            {!hideToolbar && (
              <div className={styles.toolbar}>
                <SearchInput
                  size="sm"
                  className={styles.searchInline}
                  placeholder="Find an entry…"
                  value={q}
                  onChange={setQ}
                  onClear={() => setQ('')}
                />
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
            )}

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
                          <span
                            className={styles.legendQuadDot}
                            style={{ background: quad.color }}
                          />
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
      </div>
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
