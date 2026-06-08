import { useState, useMemo, useRef, useEffect } from 'react';
import { TbChevronDown, TbX, TbChevronRight, TbCalendarWeek } from 'react-icons/tb';
import styles from './TimelineView.module.css';
import { TypeBadge } from '../components/TypeBadge';
import { StatusChip } from '../components/StatusChip';
import { Button } from '@diagram-craft/app-components/Button';
import { resolveSchemaColor } from '../api';
import type { EntityRecord, EntitySchema, WorkspaceLifecycleState } from '../api';

// ── Types ─────────────────────────────────────────────────────────────────────

type TimelineDateField = {
  id: string;
  name: string;
  isMetadata: boolean;
};

export type TimelineConfig = {
  startFieldId: string | null;
  endFieldId: string | null;
  groupBy: 'owner' | 'type';
  zoom: 'month' | 'quarter' | 'year';
};

type Col = {
  date: Date;
  label: string;
  width: number;
  isCurrent: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TL_LABEL_W = 252;
const TL_COL_W = { month: 76, quarter: 106, year: 142 } as const;

const METADATA_DATE_FIELDS: TimelineDateField[] = [
  { id: '_targetLifecycleDate', name: 'Target Lifecycle Date', isMetadata: true },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const tlParse = (s: unknown): Date | null => {
  if (typeof s !== 'string' || s === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const tlFmt = (s: unknown): string => {
  const d = tlParse(s);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const tlClamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const getDateValue = (entity: EntityRecord, fieldId: string | null): Date | null => {
  if (!fieldId) return null;
  if (fieldId === '_targetLifecycleDate') return tlParse(entity._targetLifecycleDate);
  return tlParse(entity[fieldId]);
};

const getRawDateValue = (entity: EntityRecord, fieldId: string | null): unknown => {
  if (!fieldId) return null;
  if (fieldId === '_targetLifecycleDate') return entity._targetLifecycleDate;
  return entity[fieldId];
};

const colEnd = (col: Col, zoom: TimelineConfig['zoom']): Date => {
  const d = new Date(col.date);
  if (zoom === 'month') d.setMonth(d.getMonth() + 1);
  else if (zoom === 'quarter') d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
};

const buildCols = (minDate: Date, maxDate: Date, zoom: TimelineConfig['zoom']): Col[] => {
  const today = new Date();
  const w = TL_COL_W[zoom];
  const cols: Col[] = [];

  if (zoom === 'month') {
    let d = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 1);
    while (d < end) {
      const isCurrent =
        d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      const mo = d.toLocaleString('en-US', { month: 'short' });
      cols.push({
        date: new Date(d),
        label: `${mo} '${String(d.getFullYear()).slice(2)}`,
        width: w,
        isCurrent
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  } else if (zoom === 'quarter') {
    let d = new Date(minDate.getFullYear(), Math.floor(minDate.getMonth() / 3) * 3 - 3, 1);
    const end = new Date(
      maxDate.getFullYear(),
      Math.ceil((maxDate.getMonth() + 1) / 3) * 3 + 3,
      1
    );
    while (d < end) {
      const q = Math.floor(d.getMonth() / 3) + 1;
      const todayQ = Math.floor(today.getMonth() / 3) + 1;
      const isCurrent = d.getFullYear() === today.getFullYear() && q === todayQ;
      cols.push({
        date: new Date(d),
        label: `Q${q} '${String(d.getFullYear()).slice(2)}`,
        width: w,
        isCurrent
      });
      d = new Date(d.getFullYear(), d.getMonth() + 3, 1);
    }
  } else {
    let yr = minDate.getFullYear() - 1;
    const endYr = maxDate.getFullYear() + 2;
    while (yr < endYr) {
      cols.push({
        date: new Date(yr, 0, 1),
        label: String(yr),
        width: w,
        isCurrent: yr === today.getFullYear()
      });
      yr++;
    }
  }
  return cols;
};

// ── Date field collection ─────────────────────────────────────────────────────

const useDateFieldOptions = (schemas: EntitySchema[]): TimelineDateField[] =>
  useMemo(() => {
    const seen = new Set<string>();
    const schemaFields: TimelineDateField[] = [];
    for (const schema of schemas) {
      for (const field of schema.fields) {
        if (field.type === 'date' && !seen.has(field.id)) {
          seen.add(field.id);
          schemaFields.push({ id: field.id, name: field.name, isMetadata: false });
        }
      }
    }
    return [...schemaFields, ...METADATA_DATE_FIELDS];
  }, [schemas]);

// ── Config bar ────────────────────────────────────────────────────────────────

const ConfigBar = ({
  cfg,
  onChange,
  dateFields,
  totalDated,
  totalRows
}: {
  cfg: TimelineConfig;
  onChange: (update: Partial<TimelineConfig>) => void;
  dateFields: TimelineDateField[];
  totalDated: number;
  totalRows: number;
}) => (
  <div className={styles.configBar}>
    <span className={styles.filterLabel} style={{ fontSize: 11 }}>
      Date mapping
    </span>

    <label className={styles.filter}>
      <span className={styles.filterLabel}>Start</span>
      <select
        className={styles.filterSelect}
        value={cfg.startFieldId ?? ''}
        onChange={e => onChange({ startFieldId: e.target.value || null })}
      >
        <option value="">— none —</option>
        {dateFields.map(f => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <TbChevronDown size={10} />
    </label>

    <span className={styles.configArrow}>→</span>

    <label className={styles.filter}>
      <span className={styles.filterLabel}>End</span>
      <select
        className={styles.filterSelect}
        value={cfg.endFieldId ?? ''}
        onChange={e => onChange({ endFieldId: e.target.value || null })}
      >
        <option value="">— none —</option>
        {dateFields.map(f => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <TbChevronDown size={10} />
    </label>

    <div className={styles.configSep} />

    <label className={styles.filter}>
      <span className={styles.filterLabel}>Group</span>
      <select
        className={styles.filterSelect}
        value={cfg.groupBy}
        onChange={e => onChange({ groupBy: e.target.value as TimelineConfig['groupBy'] })}
      >
        <option value="owner">By owner</option>
        <option value="type">By type</option>
      </select>
      <TbChevronDown size={10} />
    </label>

    <div className={styles.configSep} />

    <div className={styles.segmented}>
      {(['month', 'quarter', 'year'] as const).map(z => (
        <button
          key={z}
          type="button"
          className={cfg.zoom === z ? styles.segmentedActive : ''}
          onClick={() => onChange({ zoom: z })}
          title={z.charAt(0).toUpperCase() + z.slice(1)}
        >
          {z === 'month' ? 'Mo' : z === 'quarter' ? 'Qr' : 'Yr'}
        </button>
      ))}
    </div>

    <div style={{ flex: 1 }} />

    <span className={styles.configMeta}>
      {totalDated}{' '}
      <span style={{ opacity: 0.6 }}>of {totalRows} with dates</span>
    </span>
  </div>
);

// ── Detail panel ──────────────────────────────────────────────────────────────

const DetailPanel = ({
  entity,
  cfg,
  dateFields,
  schemaMap,
  lifecycleStates,
  onOpen,
  onClose
}: {
  entity: EntityRecord | null;
  cfg: TimelineConfig;
  dateFields: TimelineDateField[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
  onOpen: () => void;
  onClose: () => void;
}) => {
  const s = entity ? schemaMap.get(entity._schemaId) : null;
  const startField = dateFields.find(f => f.id === cfg.startFieldId);
  const endField = dateFields.find(f => f.id === cfg.endFieldId);

  return (
    <div className={`${styles.detail} ${entity ? styles.detailOpen : ''}`}>
      {entity && (
        <>
          <div className={styles.detailHead}>
            {s && (
              <TypeBadge
                color={resolveSchemaColor(s.schema, s.index)}
                name={s.schema.name}
                icon={s.schema.icon}
                size={22}
              />
            )}
            <div className={styles.detailMeta}>
              <div className={styles.detailName}>{entity._name ?? entity._slug}</div>
              {s && <div className={styles.detailType}>{s.schema.name}</div>}
            </div>
            <button type="button" className={styles.detailCloseBtn} onClick={onClose} title="Close">
              <TbX size={12} />
            </button>
          </div>

          <div className={styles.detailBody}>
            {entity._lifecycle && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Status</div>
                <StatusChip value={entity._lifecycle} lifecycleStates={lifecycleStates} />
              </div>
            )}
            {entity._owner && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Owner</div>
                <div className={styles.detailFieldValue}>{entity._owner}</div>
              </div>
            )}
            {startField && cfg.startFieldId && !!getRawDateValue(entity, cfg.startFieldId) && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>{startField.name}</div>
                <div className={styles.detailFieldValue}>
                  {tlFmt(getRawDateValue(entity, cfg.startFieldId))}
                </div>
              </div>
            )}
            {endField && cfg.endFieldId && !!getRawDateValue(entity, cfg.endFieldId) && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>{endField.name}</div>
                <div className={styles.detailFieldValue}>
                  {tlFmt(getRawDateValue(entity, cfg.endFieldId))}
                </div>
              </div>
            )}
            {entity._description && (
              <p className={styles.detailDesc}>{entity._description}</p>
            )}
          </div>

          <div className={styles.detailFooter}>
            <Button variant="primary" size="sm" onClick={onOpen}>
              Open full detail <TbChevronRight size={11} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

type TimelineViewProps = {
  rows: EntityRecord[];
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  onEntityClick: (entityId: string) => void;
  config: TimelineConfig | null;
  onConfigChange: (cfg: TimelineConfig) => void;
};

export const TimelineView = ({
  rows,
  schemas,
  lifecycleStates,
  onEntityClick,
  config,
  onConfigChange
}: TimelineViewProps) => {
  const dateFields = useDateFieldOptions(schemas);
  const scrollRef = useRef<HTMLDivElement>(null);
  const TODAY = useMemo(() => new Date(), []);

  // Derive effective config: use external config if provided, otherwise defaults
  const cfg: TimelineConfig = config ?? {
    startFieldId: dateFields[0]?.id ?? null,
    endFieldId: dateFields[1]?.id ?? dateFields[0]?.id ?? null,
    groupBy: 'owner',
    zoom: 'quarter'
  };

  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);

  // Keep a ref to the latest cfg so the validation effect can read it
  // without needing cfg in its dependency list (which would cause infinite loops)
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  // Reset field ids if date field options change and current ids become invalid
  useEffect(() => {
    const ids = dateFields.map(f => f.id);
    const current = cfgRef.current;
    const startValid = current.startFieldId == null || ids.includes(current.startFieldId);
    const endValid = current.endFieldId == null || ids.includes(current.endFieldId);
    if (!startValid || !endValid) {
      onConfigChangeRef.current({
        ...current,
        startFieldId: startValid ? current.startFieldId : (dateFields[0]?.id ?? null),
        endFieldId: endValid ? current.endFieldId : (dateFields[1]?.id ?? dateFields[0]?.id ?? null)
      });
    }
  }, [dateFields]);

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  // Entities with at least one configured date
  const datedRows = useMemo(
    () => rows.filter(e => getDateValue(e, cfg.startFieldId) ?? getDateValue(e, cfg.endFieldId)),
    [rows, cfg.startFieldId, cfg.endFieldId]
  );

  // Group by owner or type
  const groups = useMemo(() => {
    const g: Record<string, EntityRecord[]> = {};
    for (const e of datedRows) {
      const key =
        cfg.groupBy === 'type'
          ? (schemaMap.get(e._schemaId)?.schema.name ?? e._schemaId)
          : (e._owner ?? 'Unassigned');
      (g[key] ??= []).push(e);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [datedRows, cfg.groupBy, schemaMap]);

  // Date range + columns
  const { rangeStart, rangeEnd, columns, totalWidth } = useMemo(() => {
    const dates: Date[] = [TODAY];
    for (const e of datedRows) {
      const s = getDateValue(e, cfg.startFieldId);
      const en = getDateValue(e, cfg.endFieldId);
      if (s) dates.push(s);
      if (en) dates.push(en);
    }
    const minD = new Date(Math.min(...dates.map(d => +d)));
    const maxD = new Date(Math.max(...dates.map(d => +d)));
    const cols = buildCols(minD, maxD, cfg.zoom);
    const rs = cols[0]?.date ?? minD;
    const re = cols.length > 0 ? colEnd(cols[cols.length - 1]!, cfg.zoom) : maxD;
    const tw = cols.reduce((s, c) => s + c.width, 0);
    return { rangeStart: rs, rangeEnd: re, columns: cols, totalWidth: tw };
  }, [datedRows, cfg.startFieldId, cfg.endFieldId, cfg.zoom, TODAY]);

  const spanMs = +rangeEnd - +rangeStart;

  const dateToX = (d: Date | null): number => {
    if (!d || spanMs <= 0) return 0;
    return tlClamp(((+d - +rangeStart) / spanMs) * totalWidth, 0, totalWidth);
  };

  const todayPx = useMemo(
    () => (spanMs <= 0 ? 0 : tlClamp(((+TODAY - +rangeStart) / spanMs) * totalWidth, 0, totalWidth)),
    [TODAY, rangeStart, spanMs, totalWidth]
  );

  // Scroll to today on config changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayPx === null) return;
    el.scrollLeft = Math.max(0, TL_LABEL_W + todayPx - el.clientWidth * 0.38);
  }, [todayPx]);

  const activeEntity = useMemo(
    () => (activeEntityId ? (datedRows.find(e => e._uid === activeEntityId) ?? null) : null),
    [activeEntityId, datedRows]
  );

  const updateCfg = (update: Partial<TimelineConfig>) => onConfigChange({ ...cfg, ...update });

  return (
    <div className={styles.screen}>
      <ConfigBar
        cfg={cfg}
        onChange={updateCfg}
        dateFields={dateFields}
        totalDated={datedRows.length}
        totalRows={rows.length}
      />

      {datedRows.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <TbCalendarWeek size={26} />
          </div>
          <div className={styles.emptyTitle}>No entities with dates in this view</div>
          <span>Select a date field above, or add dates to entities.</span>
        </div>
      ) : (
        <div className={styles.scrollWrap} ref={scrollRef}>
          <div style={{ minWidth: TL_LABEL_W + totalWidth, position: 'relative' }}>
            {/* Header row */}
            <div className={styles.headerRow}>
              <div className={`${styles.labelCol} ${styles.labelColHeader}`}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                  {datedRows.length} entities
                </span>
              </div>
              <div className={styles.cols}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={`${styles.colHeader} ${col.isCurrent ? styles.colHeaderNow : ''}`}
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Today line */}
            <div
              className={styles.todayLine}
              style={{ left: TL_LABEL_W + todayPx }}
            >
              <span className={styles.todayPip}>▾</span>
            </div>

            {/* Groups */}
            {groups.map(([groupKey, entities]) => (
              <div key={groupKey}>
                {/* Group header */}
                <div className={styles.groupRow}>
                  <div className={`${styles.labelCol} ${styles.groupLabelCol}`}>
                    {groupKey}
                    <span className={styles.groupCount}>({entities.length})</span>
                  </div>
                  <div className={styles.groupSpacer} style={{ width: totalWidth }} />
                </div>

                {/* Entity rows */}
                {entities.map(e => {
                  const startD = getDateValue(e, cfg.startFieldId);
                  const endD = getDateValue(e, cfg.endFieldId);
                  const isMilestone = !startD && !!endD;
                  const isActive = activeEntityId === e._uid;
                  const s = schemaMap.get(e._schemaId);

                  const barColor =
                    lifecycleStates.find(ls => ls.id === e._lifecycle)?.color ??
                    'var(--base-fg-more-dim)';

                  let barLeft = 0;
                  let barWidth = 0;
                  if (!isMilestone && startD) {
                    barLeft = dateToX(startD);
                    const endX = dateToX(endD ?? TODAY);
                    barWidth = Math.max(6, endX - barLeft);
                  }
                  const milestoneX = isMilestone ? dateToX(endD) : 0;

                  return (
                    <div
                      key={e._uid}
                      className={`${styles.entityRow} ${isActive ? styles.entityRowActive : ''}`}
                      onClick={() => setActiveEntityId(p => (p === e._uid ? null : e._uid))}
                    >
                      {/* Sticky label */}
                      <div className={styles.labelCol}>
                        {s && (
                          <TypeBadge
                            color={resolveSchemaColor(s.schema, s.index)}
                            name={s.schema.name}
                            icon={s.schema.icon}
                            size={14}
                          />
                        )}
                        <span className={styles.entityName}>{e._name ?? e._slug}</span>
                        {e._lifecycle && (
                          <StatusChip value={e._lifecycle} lifecycleStates={lifecycleStates} />
                        )}
                      </div>

                      {/* Bar track */}
                      <div className={styles.barCell} style={{ width: totalWidth }}>
                        {!isMilestone && startD && (
                          <div
                            className={`${styles.bar} ${!endD ? styles.barOpen : ''}`}
                            style={{
                              left: barLeft,
                              width: barWidth,
                              background: barColor
                            }}
                            title={`${e._name ?? e._slug} · ${tlFmt(getRawDateValue(e, cfg.startFieldId))} → ${endD ? tlFmt(getRawDateValue(e, cfg.endFieldId)) : 'ongoing'}`}
                          >
                            {barWidth > 54 && (
                              <span className={styles.barLabel}>{e._name ?? e._slug}</span>
                            )}
                          </div>
                        )}
                        {isMilestone && (
                          <div
                            className={styles.milestone}
                            style={{ left: milestoneX, background: barColor }}
                            title={`${e._name ?? e._slug} · target: ${tlFmt(getRawDateValue(e, cfg.endFieldId))}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <DetailPanel
        entity={activeEntity}
        cfg={cfg}
        dateFields={dateFields}
        schemaMap={schemaMap}
        lifecycleStates={lifecycleStates}
        onOpen={() => {
          if (activeEntity) onEntityClick(activeEntity._uid);
        }}
        onClose={() => setActiveEntityId(null)}
      />
    </div>
  );
};
