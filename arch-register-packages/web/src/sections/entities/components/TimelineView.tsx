import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { TbX, TbChevronRight, TbCalendarWeek, TbGitBranch } from 'react-icons/tb';
import styles from './TimelineView.module.css';
import { TypeBadge } from '../../../components/TypeBadge';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { StatusChip } from '../../../components/StatusChip';
import { Button } from '@diagram-craft/app-components/Button';
import { TimelineScaffold } from '../../../components/timeline/TimelineScaffold';
import {
  buildTimelineRange,
  dateToTimelinePx,
  formatTimelineDate,
  getTodayTimelinePx,
  parseTimelineDate,
  type TimelineColumnWidths
} from '../../../components/timeline/timelineUtils';
import { resolveSchemaColor } from '../../../lib/api';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { Project } from '@arch-register/api-types/projectContract';
import { useEntitySnapshots } from '../../../hooks/useEntities';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';

// ── Types ─────────────────────────────────────────────────────────────────────

type TimelineDateField = {
  id: string;
  name: string;
  isMetadata: boolean;
};

export type TimelineConfig = {
  startFieldId: string | null;
  endFieldId: string | null;
  groupBy: 'owner' | 'type' | 'snapshot';
  zoom: 'month' | 'quarter' | 'year';
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TL_LABEL_W = 252;
const TL_COL_W: TimelineColumnWidths = { month: 76, quarter: 106, year: 142 };

const METADATA_DATE_FIELDS: TimelineDateField[] = [
  { id: '_targetLifecycleDate', name: 'Target Lifecycle Date', isMetadata: true }
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getDateValue = (entity: EntityRecord, fieldId: string | null): Date | null => {
  if (!fieldId) return null;
  if (fieldId === '_targetLifecycleDate') return parseTimelineDate(entity._targetLifecycleDate);
  return parseTimelineDate(entity[fieldId]);
};

const getRawDateValue = (entity: EntityRecord, fieldId: string | null): unknown => {
  if (!fieldId) return null;
  if (fieldId === '_targetLifecycleDate') return entity._targetLifecycleDate;
  return entity[fieldId];
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

// ── Snap status badge ─────────────────────────────────────────────────────────

const SNAP_STATUS_CLASS: Record<string, string> = {
  autosave: styles.snapStatusAutosave ?? '',
  saved_version: styles.snapStatusSavedVersion ?? '',
  future_update: styles.snapStatusFutureUpdate ?? '',
  applied: styles.snapStatusApplied ?? ''
};

const SNAP_STATUS_LABEL: Record<string, string> = {
  autosave: 'Autosave',
  saved_version: 'Saved version',
  future_update: 'Planned change',
  applied: 'Applied'
};

// ── SnapBlock ─────────────────────────────────────────────────────────────────

type SnapBlockProps = {
  entity: EntityRecord;
  isLinked: boolean;
  workspaceId: string;
  projects: Project[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  startFieldId: string | null;
  endFieldId: string | null;
  TODAY: Date;
  lifecycleStates: WorkspaceLifecycleState[];
  selectedSnapId: string | null;
  onSnapSelect: (snap: EntitySnapshot | null, entity: EntityRecord) => void;
  onEntityClick: (entityId: string) => void;
  onBarClick: (entity: EntityRecord) => void;
};

const SnapBlock = ({
  entity,
  isLinked,
  workspaceId,
  projects,
  schemaMap,
  rangeStart,
  rangeEnd,
  totalWidth,
  startFieldId,
  endFieldId,
  TODAY,
  lifecycleStates,
  selectedSnapId,
  onSnapSelect,
  onEntityClick,
  onBarClick
}: SnapBlockProps) => {
  const { data: snaps = [] } = useEntitySnapshots(workspaceId, entity._uid, true);

  const ownSnaps = useMemo(
    () =>
      snaps
        .filter(s => s.status === 'autosave' || s.status === 'saved_version')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [snaps]
  );

  const projectLanes = useMemo(() => {
    const byProject: Record<string, EntitySnapshot[]> = {};
    for (const s of snaps) {
      if (s.project_id) {
        (byProject[s.project_id] ??= []).push(s);
      }
    }
    return Object.entries(byProject).map(([pid, laneSnaps]) => ({
      projectId: pid,
      snaps: laneSnaps
    }));
  }, [snaps]);

  const toPx = (d: Date | null): number => {
    return dateToTimelinePx(d, rangeStart, rangeEnd, totalWidth);
  };

  const s = schemaMap.get(entity._schema.id);
  const barColor =
    lifecycleStates.find(ls => ls.id === entity._lifecycle?.id)?.color ??
    'var(--base-fg-more-dim)';

  const startD = getDateValue(entity, startFieldId);
  const endD = getDateValue(entity, endFieldId);
  const isMilestone = !startD && !!endD;

  let barLeft = 0;
  let barWidth = 0;
  if (!isMilestone && startD) {
    barLeft = toPx(startD);
    const endX = toPx(endD ?? TODAY);
    barWidth = Math.max(4, endX - barLeft);
  }
  const milestoneX = isMilestone ? toPx(endD) : 0;

  return (
    <div className={styles.snapBlock}>
      {/* Entity header row */}
      <div className={styles.snapHeader}>
        <div className={`${styles.labelCol} ${styles.labelColClickable}`} onClick={() => onEntityClick(entity._publicId)}>
          {s && (
            <TypeBadge
              color={resolveSchemaColor(s.schema, s.index)}
              name={s.schema.name}
              icon={s.schema.icon}
              size={14}
            />
          )}
          <span
            className={styles.entityName}
            style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
          >
            {entity._name ?? entity._slug}
          </span>
          {entity._lifecycle && (
            <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
        </div>
        <div className={styles.barCell} style={{ width: totalWidth }}>
          {!isMilestone && startD && (
            <div
              className={`${styles.bar} ${!endD ? styles.barOpen : ''}`}
              style={{ left: barLeft, width: barWidth, background: barColor }}
              onClick={ev => { ev.stopPropagation(); onBarClick(entity); }}
            />
          )}
          {isMilestone && (
            <div
              className={styles.milestone}
              style={{ left: milestoneX, background: barColor }}
              onClick={ev => { ev.stopPropagation(); onBarClick(entity); }}
            />
          )}
        </div>
      </div>

      {/* Own history lane */}
      {ownSnaps.length > 0 && (
        <div className={`${styles.snapLane} ${styles.snapLaneOwn}`}>
          <div className={`${styles.labelCol} ${styles.snapLaneLabel}`}>
            <TbGitBranch size={10} style={{ color: 'var(--base-fg-more-dim)', flexShrink: 0 }} />
            <span>Own history</span>
          </div>
          <div className={`${styles.barCell} ${styles.snapTrack}`} style={{ width: totalWidth }}>
            <div className={styles.snapBaseline} />
            {ownSnaps.map(snap => {
              const px = toPx(new Date(snap.created_at));
              const isSel = selectedSnapId === snap.id;
              const dotClass =
                snap.status === 'saved_version'
                  ? styles.snapDotSavedVersion
                  : styles.snapDotAutosave;
              return (
                <div
                  key={snap.id}
                  className={`${styles.snapDot} ${dotClass} ${isSel ? styles.snapDotSelected : ''}`}
                  style={{ left: px }}
                  onClick={ev => {
                    ev.stopPropagation();
                    onSnapSelect(isSel ? null : snap, entity);
                  }}
                  title={snap.commit_message ?? snap.status}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Project lanes */}
      {projectLanes.map(({ projectId, snaps: laneSnaps }) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return null;
        const projectColor = project.color ?? 'var(--accent-fg)';
        return (
          <div key={projectId} className={styles.snapLane}>
            <div className={`${styles.labelCol} ${styles.snapLaneLabel}`}>
              <span className={styles.snapProjDot} style={{ background: projectColor }} />
              <span>{project.name}</span>
            </div>
            <div className={`${styles.barCell} ${styles.snapTrack}`} style={{ width: totalWidth }}>
              <div className={styles.snapBaseline} />
              {laneSnaps.map(snap => {
                if (!snap.target_date) return null;
                const px = toPx(new Date(`${snap.target_date}T00:00:00`));
                const isSel = selectedSnapId === snap.id;
                const dotClass =
                  snap.status === 'applied' ? styles.snapDotApplied : styles.snapDotFutureUpdate;
                return (
                  <div
                    key={snap.id}
                    className={`${styles.snapDot} ${dotClass} ${isSel ? styles.snapDotSelected : ''}`}
                    style={
                      { left: px, '--snap-color': projectColor } as React.CSSProperties
                    }
                    onClick={ev => {
                      ev.stopPropagation();
                      onSnapSelect(isSel ? null : snap, entity);
                    }}
                    title={snap.commit_message ?? snap.status}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Snap detail panel ─────────────────────────────────────────────────────────

const SnapDetailPanel = ({
  detail,
  isLinked,
  projects,
  schemaMap,
  lifecycleStates,
  onEntityClick,
  onClose
}: {
  detail: { snap: EntitySnapshot; entity: EntityRecord } | null;
  isLinked: boolean;
  projects: Project[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
  onEntityClick: (id: string) => void;
  onClose: () => void;
}) => {
  const { snap, entity } = detail ?? {};
  const s = entity ? schemaMap.get(entity._schema.id) : null;
  const project = snap?.project_id ? projects.find(p => p.id === snap.project_id) : null;

  return (
    <div className={`${styles.detail} ${detail ? styles.detailOpen : ''}`}>
      {detail && snap && entity && (
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
              <div
                className={styles.detailName}
                style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
              >
                {entity._name ?? entity._slug}
              </div>
              {s && <div className={styles.detailType}>{s.schema.name}</div>}
            </div>
            <button type="button" className={styles.detailCloseBtn} onClick={onClose} title="Close">
              <TbX size={12} />
            </button>
          </div>

          <div className={styles.detailBody}>
            <div className={styles.detailField}>
              <div className={styles.detailFieldLabel}>Snapshot type</div>
              <span
                className={`${styles.snapStatusBadge} ${SNAP_STATUS_CLASS[snap.status] ?? ''}`}
              >
                {SNAP_STATUS_LABEL[snap.status] ?? snap.status}
              </span>
            </div>

            {project && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Project</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: project.color ?? 'var(--accent-fg)',
                      flexShrink: 0
                    }}
                  />
                  <span className={styles.detailFieldValue}>{project.name}</span>
                </div>
              </div>
            )}

            <div className={styles.detailField}>
              <div className={styles.detailFieldLabel}>
                {snap.project_id ? 'Target date' : 'Captured'}
              </div>
              <div className={styles.detailFieldValue}>
                {snap.project_id ? (snap.target_date ?? '—') : formatTimelineDate(snap.created_at)}
              </div>
            </div>

            {snap.commit_message && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Note</div>
                <p className={styles.detailDesc}>{snap.commit_message}</p>
              </div>
            )}

            {entity._lifecycle && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Entity status</div>
                <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
              </div>
            )}
          </div>

          <div className={styles.detailFooter}>
            <Button variant="primary" size="sm" onClick={() => onEntityClick(entity._publicId)}>
              Open entity <TbChevronRight size={11} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

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
    <span className={styles.configMeta}>Date mapping</span>

    <FilterDropdown
      label="Start"
      value={cfg.startFieldId ?? ''}
      onChange={v => onChange({ startFieldId: v || null })}
      options={[
        { value: '', label: '— none —' },
        ...dateFields.map(f => ({ value: f.id, label: f.name }))
      ]}
    />

    <span className={styles.configArrow}>→</span>

    <FilterDropdown
      label="End"
      value={cfg.endFieldId ?? ''}
      onChange={v => onChange({ endFieldId: v || null })}
      options={[
        { value: '', label: '— none —' },
        ...dateFields.map(f => ({ value: f.id, label: f.name }))
      ]}
    />

    <div className={styles.configSep} />

    <FilterDropdown
      label="Group"
      value={cfg.groupBy}
      onChange={v => onChange({ groupBy: v as TimelineConfig['groupBy'] })}
      options={[
        { value: 'owner', label: 'By owner' },
        { value: 'type', label: 'By type' },
        { value: 'snapshot', label: 'Entity + project' }
      ]}
    />

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
      {totalDated} <span style={{ opacity: 0.6 }}>of {totalRows}</span>
    </span>
  </div>
);

// ── Detail panel ──────────────────────────────────────────────────────────────

const DetailPanel = ({
  entity,
  isLinked,
  cfg,
  dateFields,
  schemaMap,
  onOpen,
  onClose
}: {
  entity: EntityRecord | null;
  isLinked: boolean;
  cfg: TimelineConfig;
  dateFields: TimelineDateField[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onOpen: () => void;
  onClose: () => void;
}) => {
  const s = entity ? schemaMap.get(entity._schema.id) : null;
  const startField = dateFields.find(f => f.id === cfg.startFieldId);
  const endField = dateFields.find(f => f.id === cfg.endFieldId);
  const startVal = entity ? getRawDateValue(entity, cfg.startFieldId) : null;
  const endVal = entity ? getRawDateValue(entity, cfg.endFieldId) : null;
  const isMilestone = entity ? !getDateValue(entity, cfg.startFieldId) && !!getDateValue(entity, cfg.endFieldId) : false;

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
              <div
                className={styles.detailName}
                style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
              >
                {entity._name ?? entity._slug}
              </div>
              {s && <div className={styles.detailType}>{s.schema.name}</div>}
            </div>
            <button type="button" className={styles.detailCloseBtn} onClick={onClose} title="Close">
              <TbX size={12} />
            </button>
          </div>

          <div className={styles.detailBody}>
            {!isMilestone && startField && !!startVal && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>{startField.name}</div>
                <div className={styles.detailFieldValue}>{formatTimelineDate(startVal)}</div>
              </div>
            )}
            {endField && !!endVal && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>
                  {isMilestone ? `Target (${endField.name})` : endField.name}
                </div>
                <div className={styles.detailFieldValue}>{formatTimelineDate(endVal)}</div>
              </div>
            )}
          </div>

          <div className={styles.detailFooter}>
            <Button variant="primary" size="sm" onClick={onOpen}>
              Open entity <TbChevronRight size={11} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

type TimelineViewProps = EntityBrowserRowViewProps & {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  config: TimelineConfig | null;
  onConfigChange: (cfg: TimelineConfig) => void;
  workspaceId: string;
  projects: Project[];
};

export const TimelineView = ({
  rows,
  schemas,
  lifecycleStates,
  onEntityClick,
  config,
  onConfigChange,
  workspaceId,
  projects,
  linkedEntityIds
}: TimelineViewProps) => {
  const dateFields = useDateFieldOptions(schemas);
  const TODAY = useMemo(() => new Date(), []);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  // Derive effective config: use external config if provided, otherwise defaults
  const cfg: TimelineConfig = config ?? {
    startFieldId: dateFields[0]?.id ?? null,
    endFieldId: dateFields[1]?.id ?? dateFields[0]?.id ?? null,
    groupBy: 'owner',
    zoom: 'quarter'
  };

  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [snapDetail, setSnapDetail] = useState<{
    snap: EntitySnapshot;
    entity: EntityRecord;
  } | null>(null);

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

  // Group by owner or type (not used in snapshot mode)
  const groups = useMemo(() => {
    if (cfg.groupBy === 'snapshot') return [];
    const g: Record<string, EntityRecord[]> = {};
    for (const e of datedRows) {
      const key =
        cfg.groupBy === 'type'
          ? (schemaMap.get(e._schema.id)?.schema.name ?? e._schema.id)
          : (e._owner?.name ?? 'Unassigned');
      (g[key] ??= []).push(e);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [datedRows, cfg.groupBy, schemaMap]);

  // Date range + columns
  const { rangeStart, rangeEnd, columns, totalWidth } = useMemo(() => {
    const dates: Date[] = [];
    const sourceRows = cfg.groupBy === 'snapshot' ? rows : datedRows;
    for (const e of sourceRows) {
      const s = getDateValue(e, cfg.startFieldId);
      const en = getDateValue(e, cfg.endFieldId);
      if (s) dates.push(s);
      if (en) dates.push(en);
    }
    const fallbackDates =
      cfg.groupBy === 'snapshot'
        ? [new Date(TODAY.getFullYear() - 1, 0, 1), new Date(TODAY.getFullYear() + 1, 11, 31)]
        : [];
    return buildTimelineRange({
      dates,
      zoom: cfg.zoom,
      columnWidths: TL_COL_W,
      today: TODAY,
      fallbackDates
    });
  }, [datedRows, rows, cfg.startFieldId, cfg.endFieldId, cfg.zoom, cfg.groupBy, TODAY]);

  const todayPx = useMemo(
    () => getTodayTimelinePx(TODAY, rangeStart, rangeEnd, totalWidth),
    [TODAY, rangeStart, rangeEnd, totalWidth]
  );

  const activeEntity = useMemo(
    () =>
      activeEntityId
        ? ((cfg.groupBy === 'snapshot' ? rows : datedRows).find(e => e._uid === activeEntityId) ?? null)
        : null,
    [activeEntityId, datedRows, rows, cfg.groupBy]
  );

  const updateCfg = useCallback(
    (update: Partial<TimelineConfig>) => {
      if (update.groupBy && update.groupBy !== cfg.groupBy) {
        setActiveEntityId(null);
        setSnapDetail(null);
      }
      onConfigChange({ ...cfg, ...update });
    },
    [cfg, onConfigChange]
  );

  const handleSnapSelect = useCallback(
    (snap: EntitySnapshot | null, entity: EntityRecord) => {
      setSnapDetail(snap ? { snap, entity } : null);
      setActiveEntityId(null);
    },
    []
  );

  const handleBarClick = useCallback((entity: EntityRecord) => {
    setActiveEntityId(entity._uid);
    setSnapDetail(null);
  }, []);

  const isSnapshotMode = cfg.groupBy === 'snapshot';
  const isEmpty = isSnapshotMode ? rows.length === 0 : datedRows.length === 0;
  const totalDated = isSnapshotMode ? rows.length : datedRows.length;

  return (
    <div className={styles.screen}>
      <ConfigBar
        cfg={cfg}
        onChange={updateCfg}
        dateFields={dateFields}
        totalDated={totalDated}
        totalRows={rows.length}
      />

      {isEmpty ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <TbCalendarWeek size={26} />
          </div>
          <div className={styles.emptyTitle}>
            {isSnapshotMode
              ? 'No entities in this view'
              : 'No entities with dates in this view'}
          </div>
          <span>
            {isSnapshotMode
              ? 'Add entities to see their snapshot history and planned project changes.'
              : 'Select a date field above, or add dates to entities.'}
          </span>
        </div>
      ) : (
        <TimelineScaffold
          scrollClassName={styles.scrollWrap}
          labelWidth={TL_LABEL_W}
          totalWidth={totalWidth}
          todayPx={todayPx}
          todayScrollAlign={0.38}
          header={
            <div className={styles.headerRow}>
              <div className={`${styles.labelCol} ${styles.labelColHeader}`}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                  {isSnapshotMode ? `${rows.length} entities` : `${datedRows.length} entities`}
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
          }
          todayLine={
            todayPx === null ? null : (
              <div className={styles.todayLine} style={{ left: TL_LABEL_W + todayPx }}>
                <span className={styles.todayPip}>▾</span>
              </div>
            )
          }
        >

            {/* Standard groups (owner / type) */}
            {!isSnapshotMode &&
              groups.map(([groupKey, entities]) => (
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
                    const sc = schemaMap.get(e._schema.id);

                    const barColor =
                      lifecycleStates.find(ls => ls.id === e._lifecycle?.id)?.color ??
                      'var(--base-fg-more-dim)';

                    let barLeft = 0;
                    let barWidth = 0;
                    if (!isMilestone && startD) {
                      barLeft = dateToTimelinePx(startD, rangeStart, rangeEnd, totalWidth);
                      const endX = dateToTimelinePx(endD ?? TODAY, rangeStart, rangeEnd, totalWidth);
                      barWidth = Math.max(6, endX - barLeft);
                    }
                    const milestoneX = isMilestone
                      ? dateToTimelinePx(endD, rangeStart, rangeEnd, totalWidth)
                      : 0;

                    const togglePanel = (ev: React.MouseEvent) => {
                      ev.stopPropagation();
                      setActiveEntityId(p => (p === e._uid ? null : e._uid));
                    };

                    return (
                      <div
                        key={e._uid}
                        className={`${styles.entityRow} ${isActive ? styles.entityRowActive : ''}`}
                      >
                        {/* Sticky label — click navigates to entity */}
                        <div
                          className={`${styles.labelCol} ${styles.labelColClickable}`}
                          onClick={() => onEntityClick(e._publicId)}
                        >
                          {sc && (
                            <TypeBadge
                              color={resolveSchemaColor(sc.schema, sc.index)}
                              name={sc.schema.name}
                              icon={sc.schema.icon}
                              size={14}
                            />
                          )}
                          <span
                            className={styles.entityName}
                            style={
                              linkedEntityIds != null && !linkedEntityIdSet.has(e._uid)
                                ? { color: 'var(--base-fg-more-dim)' }
                                : undefined
                            }
                          >
                            {e._name ?? e._slug}
                          </span>
                          {e._lifecycle && (
                            <StatusChip value={e._lifecycle.id} lifecycleStates={lifecycleStates} />
                          )}
                        </div>

                        {/* Bar track — click on bar/milestone opens detail panel */}
                        <div className={styles.barCell} style={{ width: totalWidth }}>
                          {!isMilestone && startD && (
                            <div
                              className={`${styles.bar} ${!endD ? styles.barOpen : ''}`}
                              style={{
                                left: barLeft,
                                width: barWidth,
                                background: barColor
                              }}
                              title={`${e._name ?? e._slug} · ${formatTimelineDate(getRawDateValue(e, cfg.startFieldId))} → ${endD ? formatTimelineDate(getRawDateValue(e, cfg.endFieldId)) : 'ongoing'}`}
                              onClick={togglePanel}
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
                              title={`${e._name ?? e._slug} · target: ${formatTimelineDate(getRawDateValue(e, cfg.endFieldId))}`}
                              onClick={togglePanel}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

            {/* Snapshot mode: one block per entity */}
            {isSnapshotMode &&
              rows.map(entity => (
                <SnapBlock
                  key={entity._uid}
                  entity={entity}
                  workspaceId={workspaceId}
                  projects={projects}
                  schemaMap={schemaMap}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  totalWidth={totalWidth}
                  startFieldId={cfg.startFieldId}
                  endFieldId={cfg.endFieldId}
                  TODAY={TODAY}
                  lifecycleStates={lifecycleStates}
                  isLinked={linkedEntityIds == null || linkedEntityIdSet.has(entity._uid)}
                  selectedSnapId={snapDetail?.snap.id ?? null}
                  onSnapSelect={handleSnapSelect}
                  onEntityClick={onEntityClick}
                  onBarClick={handleBarClick}
                />
              ))}
        </TimelineScaffold>
      )}

      {/* Entity detail panel (bar/milestone click in all modes) */}
      <DetailPanel
        entity={activeEntity}
        isLinked={activeEntity == null || linkedEntityIds == null || linkedEntityIdSet.has(activeEntity._uid)}
        cfg={cfg}
        dateFields={dateFields}
        schemaMap={schemaMap}
        onOpen={() => {
          if (activeEntity) onEntityClick(activeEntity._publicId);
        }}
        onClose={() => setActiveEntityId(null)}
      />

      {/* Snapshot detail panel (snap dot click in snapshot mode) */}
      <SnapDetailPanel
        detail={snapDetail}
        isLinked={snapDetail == null || linkedEntityIds == null || linkedEntityIdSet.has(snapDetail.entity._uid)}
        projects={projects}
        schemaMap={schemaMap}
        lifecycleStates={lifecycleStates}
        onEntityClick={onEntityClick}
        onClose={() => setSnapDetail(null)}
      />
    </div>
  );
};
