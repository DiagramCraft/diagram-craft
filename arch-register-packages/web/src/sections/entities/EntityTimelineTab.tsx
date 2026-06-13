import { useState, useMemo, useRef, useEffect } from 'react';
import { TbX } from 'react-icons/tb';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Project, ProjectEntity } from '@arch-register/api-types/projectContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '../../lib/api';
import styles from './EntityDetailScreen.module.css';

// ── Snapshot diff helpers ─────────────────────────────────────────────────────
type ChangeRow = { label: string; from: string; to: string };

type SnapshotState = Record<string, unknown>;

const BUILT_IN: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'target_lifecycle', label: 'Target lifecycle' },
  { key: 'target_lifecycle_date', label: 'Target date' },
  { key: 'owner', label: 'Owner' },
];

function resolveBuiltIn(
  key: string,
  value: unknown,
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[]
): string {
  if (value == null || value === '') return '—';
  if (key === 'lifecycle' || key === 'target_lifecycle') {
    return lifecycleStates.find(s => s.id === value)?.label ?? String(value);
  }
  if (key === 'owner') {
    return teams.find(t => t.id === value)?.name ?? String(value);
  }
  return String(value);
}

type AnyField = EntitySchema['fields'][number];

function resolveFieldVal(field: AnyField | undefined, value: unknown): string {
  if (value == null || value === '') return '—';
  if (field?.type === 'select') {
    const opt = (field as Extract<AnyField, { type: 'select' }>).options.find(
      o => o.value === String(value)
    );
    return opt?.label ?? String(value);
  }
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function diffSnapshotState(
  base: SnapshotState | null | undefined,
  proposed: SnapshotState | null | undefined,
  schema: EntitySchema | null,
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[]
): ChangeRow[] {
  if (!proposed) return [];
  const changes: ChangeRow[] = [];

  for (const { key, label } of BUILT_IN) {
    const from = base?.[key];
    const to = proposed[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes.push({
      label,
      from: resolveBuiltIn(key, from, lifecycleStates, teams),
      to: resolveBuiltIn(key, to, lifecycleStates, teams)
    });
  }

  const baseData = (base?.data ?? {}) as Record<string, unknown>;
  const proposedData = (proposed.data ?? {}) as Record<string, unknown>;
  for (const [fieldId, toVal] of Object.entries(proposedData)) {
    const fromVal = baseData[fieldId];
    if (JSON.stringify(fromVal) === JSON.stringify(toVal)) continue;
    const field = schema?.fields.find(f => f.id === fieldId);
    changes.push({
      label: field?.name ?? fieldId,
      from: resolveFieldVal(field, fromVal),
      to: resolveFieldVal(field, toVal)
    });
  }

  return changes;
}

type EntityProject = { project: Project; entity_type: ProjectEntity['entity_type'] };
type Zoom = 'month' | 'quarter' | 'year';

const LABEL_W = 200;
const COL_W: Record<Zoom, number> = { month: 72, quarter: 100, year: 136 };

// ── Time helpers ──────────────────────────────────────────────────────────────
const fmtDate = (s: string | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Col = { date: Date; label: string; width: number; isCurrent: boolean };

function buildCols(minD: Date, maxD: Date, zoom: Zoom): Col[] {
  const today = new Date();
  const w = COL_W[zoom];
  const cols: Col[] = [];

  if (zoom === 'month') {
    let d = new Date(minD.getFullYear(), minD.getMonth() - 1, 1);
    const end = new Date(maxD.getFullYear(), maxD.getMonth() + 2, 1);
    while (d < end) {
      const isCurrent =
        d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      cols.push({
        date: new Date(d),
        label: `${d.toLocaleString(undefined, { month: 'short' })}'${String(d.getFullYear()).slice(2)}`,
        width: w,
        isCurrent
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  } else if (zoom === 'quarter') {
    let d = new Date(minD.getFullYear(), Math.floor(minD.getMonth() / 3) * 3 - 3, 1);
    const end = new Date(maxD.getFullYear(), Math.ceil((maxD.getMonth() + 1) / 3) * 3 + 3, 1);
    while (d < end) {
      const q = Math.floor(d.getMonth() / 3) + 1;
      const tq = Math.floor(today.getMonth() / 3) + 1;
      const isCurrent = d.getFullYear() === today.getFullYear() && q === tq;
      cols.push({
        date: new Date(d),
        label: `Q${q} '${String(d.getFullYear()).slice(2)}`,
        width: w,
        isCurrent
      });
      d = new Date(d.getFullYear(), d.getMonth() + 3, 1);
    }
  } else {
    let yr = minD.getFullYear() - 1;
    while (yr <= maxD.getFullYear() + 2) {
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
}

function colEnd(col: Col, zoom: Zoom): Date {
  const d = new Date(col.date);
  if (zoom === 'month') d.setMonth(d.getMonth() + 1);
  else if (zoom === 'quarter') d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

function toPx(dateStr: string | null | undefined, rs: Date, re: Date, tw: number): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr).getTime();
  return clamp((t - rs.getTime()) / (re.getTime() - rs.getTime()) * tw, 0, tw);
}

function detectConflicts(snapshots: EntitySnapshot[]): {
  conflictedProjectIds: Set<string>;
  conflictedSnapIds: Set<string>;
} {
  const futures = snapshots.filter(s => s.status === 'future_update');
  const conflictedProjectIds = new Set<string>();
  const conflictedSnapIds = new Set<string>();
  for (let i = 0; i < futures.length; i++) {
    for (let j = i + 1; j < futures.length; j++) {
      const a = futures[i]!;
      const b = futures[j]!;
      const aKeys = Object.keys(a.proposed_state ?? {});
      const bKeys = new Set(Object.keys(b.proposed_state ?? {}));
      if (aKeys.some(f => bKeys.has(f))) {
        if (a.project_id) conflictedProjectIds.add(a.project_id);
        if (b.project_id) conflictedProjectIds.add(b.project_id);
        conflictedSnapIds.add(a.id);
        conflictedSnapIds.add(b.id);
      }
    }
  }
  return { conflictedProjectIds, conflictedSnapIds };
}

// ── Main component ─────────────────────────────────────────────────────────────
export const EntityTimelineTab = ({
  allSnapshots,
  entityProjects,
  schema,
  lifecycleStates,
  teams
}: {
  allSnapshots: EntitySnapshot[];
  entityProjects: EntityProject[];
  schema: EntitySchema | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const [zoom, setZoom] = useState<Zoom>('quarter');
  const [selectedSnap, setSelectedSnap] = useState<EntitySnapshot | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const TODAY = useMemo(() => new Date(), []);

  const ownSnaps = useMemo(
    () =>
      allSnapshots
        .filter(s => s.status === 'autosave' || s.status === 'saved_version')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [allSnapshots]
  );

  const projectLanes = useMemo(() => {
    const byP = new Map<string, EntitySnapshot[]>();
    for (const s of allSnapshots) {
      if (s.status !== 'future_update' && s.status !== 'applied') continue;
      if (!s.project_id) continue;
      const list = byP.get(s.project_id);
      if (list) list.push(s);
      else byP.set(s.project_id, [s]);
    }
    return [...byP.entries()].map(([projectId, snaps]) => ({ projectId, snaps }));
  }, [allSnapshots]);

  const { conflictedProjectIds, conflictedSnapIds } = useMemo(
    () => detectConflicts(allSnapshots),
    [allSnapshots]
  );

  const projectMap = useMemo(
    () => new Map(entityProjects.map(ep => [ep.project.id, ep.project])),
    [entityProjects]
  );

  const { rangeStart, rangeEnd, columns, totalWidth } = useMemo(() => {
    const dates: Date[] = [TODAY];
    for (const s of ownSnaps) if (s.created_at) dates.push(new Date(s.created_at));
    for (const { snaps } of projectLanes) {
      for (const s of snaps) {
        if (s.created_at) dates.push(new Date(s.created_at));
        if (s.target_date) dates.push(new Date(`${s.target_date}T00:00:00`));
      }
    }
    if (dates.length < 2) dates.push(new Date(TODAY.getFullYear() + 1, 0, 1));
    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    const cols = buildCols(minD, maxD, zoom);
    const rs = cols[0]?.date ?? minD;
    const re = cols.length ? colEnd(cols[cols.length - 1]!, zoom) : maxD;
    const tw = cols.reduce((s, c) => s + c.width, 0);
    return { rangeStart: rs, rangeEnd: re, columns: cols, totalWidth: tw };
  }, [ownSnaps, projectLanes, zoom, TODAY]);

  const todayPx = useMemo(() => {
    if (!totalWidth || rangeEnd <= rangeStart) return null;
    return clamp(
      (TODAY.getTime() - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime()) * totalWidth,
      0,
      totalWidth
    );
  }, [TODAY, rangeStart, rangeEnd, totalWidth]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayPx === null) return;
    el.scrollLeft = Math.max(0, LABEL_W + todayPx - el.clientWidth * 0.5);
  }, [todayPx]);

  const handleSelect = (snap: EntitySnapshot | null) => {
    setSelectedSnap(prev => (snap?.id === prev?.id ? null : snap));
  };

  const hasData = ownSnaps.length > 0 || projectLanes.length > 0;

  if (!hasData) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No snapshot history yet</div>
        <div>Snapshots are created automatically when the entity is saved.</div>
      </div>
    );
  }

  return (
    <div className={styles.etl}>
      {/* Config bar */}
      <div className={styles.etlConfig}>
        <div className={styles.etlLegend}>
          <span className={`${styles.etlLegItem} ${styles.etlLegAutosave}`}>Autosave</span>
          <span className={`${styles.etlLegItem} ${styles.etlLegSaved}`}>Saved version</span>
          <span className={`${styles.etlLegItem} ${styles.etlLegFuture}`}>Planned</span>
          <span className={`${styles.etlLegItem} ${styles.etlLegApplied}`}>Applied</span>
          {conflictedProjectIds.size > 0 && (
            <span className={`${styles.etlLegItem} ${styles.etlLegConflict}`}>Conflict</span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <span className={styles.etlConfigMeta}>
          {ownSnaps.length} own · {projectLanes.length} project{projectLanes.length !== 1 ? 's' : ''}
        </span>
        <div className={styles.etlSep} />
        <div className={styles.etlSegmented}>
          {(['month', 'quarter', 'year'] as const).map((z, i) => (
            <button
              key={z}
              type="button"
              className={zoom === z ? styles.etlSegActive : undefined}
              onClick={() => setZoom(z)}
            >
              {(['Mo', 'Qr', 'Yr'] as const)[i]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.etlBody}>
        <div className={styles.etlScroll} ref={scrollRef}>
          <div className={styles.etlInner} style={{ minWidth: LABEL_W + totalWidth }}>
            {/* Column headers */}
            <div className={styles.etlHead}>
              <div className={styles.etlCorner}>
                <span className={styles.etlCornerLabel}>Lanes</span>
              </div>
              <div className={styles.etlCols} style={{ width: totalWidth }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={`${styles.etlCol} ${col.isCurrent ? styles.etlColNow : ''}`}
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Today line */}
            {todayPx !== null && (
              <div className={styles.etlToday} style={{ left: LABEL_W + todayPx }}>
                <span className={styles.etlTodayPip}>▾</span>
              </div>
            )}

            {/* Own history lane */}
            {ownSnaps.length > 0 && (
              <OwnHistoryLane
                snaps={ownSnaps}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                totalWidth={totalWidth}
                selectedId={selectedSnap?.id}
                onSelect={handleSelect}
              />
            )}

            {/* Project lanes */}
            {projectLanes.map(({ projectId, snaps }) => (
              <ProjectLane
                key={projectId}
                project={projectMap.get(projectId) ?? null}
                snaps={snaps}
                isConflicted={conflictedProjectIds.has(projectId)}
                conflictedSnapIds={conflictedSnapIds}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                totalWidth={totalWidth}
                selectedId={selectedSnap?.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        {selectedSnap && (
          <SnapDetail
            snapshot={selectedSnap}
            project={projectMap.get(selectedSnap.project_id ?? '') ?? null}
            schema={schema}
            lifecycleStates={lifecycleStates}
            teams={teams}
            onClose={() => setSelectedSnap(null)}
          />
        )}
      </div>
    </div>
  );
};

// ── Own history lane ───────────────────────────────────────────────────────────
const OwnHistoryLane = ({
  snaps,
  rangeStart,
  rangeEnd,
  totalWidth,
  selectedId,
  onSelect
}: {
  snaps: EntitySnapshot[];
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  selectedId: string | undefined;
  onSelect: (snap: EntitySnapshot | null) => void;
}) => (
  <div className={`${styles.etlLane} ${styles.etlLaneOwn}`}>
    <div className={`${styles.etlLaneLabel} ${styles.etlLaneOwnLabel}`}>
      <span className={styles.etlLaneName}>Own history</span>
      <span className={styles.etlLaneDim}>({snaps.length})</span>
    </div>
    <div className={`${styles.etlTrack} ${styles.etlTrackOwn}`} style={{ width: totalWidth }}>
      <div className={styles.etlBaseline} />
      {snaps.map(snap => {
        const px = toPx(snap.created_at, rangeStart, rangeEnd, totalWidth);
        if (px === null) return null;
        const isSaved = snap.status === 'saved_version';
        const isSelected = selectedId === snap.id;
        const dotClass = snap.status === 'autosave' ? styles.etlDotAutosave : styles.etlDotSavedVersion;
        return (
          <div
            key={snap.id}
            className={`${styles.etlDot} ${dotClass} ${isSelected ? styles.etlDotSelected : ''}`}
            style={{ left: px }}
            onClick={() => onSelect(isSelected ? null : snap)}
            title={snap.commit_message ?? fmtDate(snap.created_at, { month: 'short', year: 'numeric' })}
          >
            <div className={styles.etlDotInner} />
            {isSaved && snap.commit_message && (
              <div className={styles.etlDotLabel}>{snap.commit_message}</div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ── Project lane ───────────────────────────────────────────────────────────────
const ProjectLane = ({
  project,
  snaps,
  isConflicted,
  conflictedSnapIds,
  rangeStart,
  rangeEnd,
  totalWidth,
  selectedId,
  onSelect
}: {
  project: Project | null;
  snaps: EntitySnapshot[];
  isConflicted: boolean;
  conflictedSnapIds: Set<string>;
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  selectedId: string | undefined;
  onSelect: (snap: EntitySnapshot | null) => void;
}) => {
  const allApplied = snaps.every(s => s.status === 'applied');
  const [collapsed, setCollapsed] = useState(allApplied);

  const futureCt = snaps.filter(s => s.status === 'future_update').length;
  const appliedCt = snaps.filter(s => s.status === 'applied').length;
  const projectColor = project?.color ?? undefined;

  return (
    <div className={`${styles.etlLane} ${isConflicted ? styles.etlLaneConflicted : ''}`}>
      <button
        type="button"
        className={`${styles.etlLaneLabel} ${styles.etlLaneLabelClickable}`}
        onClick={() => setCollapsed(c => !c)}
      >
        <span className={styles.etlChevron} style={{ transform: collapsed ? 'none' : 'rotate(90deg)' }}>›</span>
        {projectColor && (
          <span className={styles.etlProjDot} style={{ background: projectColor }} />
        )}
        <span className={styles.etlLaneName}>{project?.name ?? 'Project'}</span>
        <div className={styles.etlLaneCounts}>
          {futureCt > 0 && <span className={styles.etlCountFuture}>{futureCt}▲</span>}
          {appliedCt > 0 && <span className={styles.etlCountApplied}>{appliedCt}✓</span>}
        </div>
        {isConflicted && <span className={styles.etlConflictBadge}>Conflict</span>}
      </button>

      {!collapsed && (
        <div className={styles.etlTrack} style={{ width: totalWidth }}>
          <div className={styles.etlBaseline} />
          {snaps.map(snap => {
            const dateStr = snap.status === 'future_update' || snap.status === 'applied'
              ? (snap.target_date ?? snap.created_at)
              : snap.created_at;
            const px = toPx(dateStr, rangeStart, rangeEnd, totalWidth);
            if (px === null) return null;
            const isSelected = selectedId === snap.id;
            const isSnapConflict = conflictedSnapIds.has(snap.id);
            const dotClass = snap.status === 'applied' ? styles.etlDotApplied : styles.etlDotFutureUpdate;
            return (
              <div
                key={snap.id}
                className={`${styles.etlDot} ${dotClass} ${isSelected ? styles.etlDotSelected : ''} ${isSnapConflict ? styles.etlDotConflict : ''}`}
                style={{ left: px }}
                onClick={() => onSelect(isSelected ? null : snap)}
                title={snap.commit_message ?? snap.status}
              >
                <div
                  className={styles.etlDotInner}
                  style={snap.status === 'future_update' && projectColor ? { background: projectColor } : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Detail panel ───────────────────────────────────────────────────────────────
const SnapDetail = ({
  snapshot,
  project,
  schema,
  lifecycleStates,
  teams,
  onClose
}: {
  snapshot: EntitySnapshot;
  project: Project | null;
  schema: EntitySchema | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  onClose: () => void;
}) => {
  const isFuture = snapshot.status === 'future_update';
  const isApplied = snapshot.status === 'applied';
  const isOwn = snapshot.status === 'autosave' || snapshot.status === 'saved_version';

  const statusColor = isApplied
    ? 'var(--green)'
    : isFuture
      ? (project?.color ?? 'var(--accent-fg)')
      : isOwn
        ? 'var(--accent-fg)'
        : 'var(--cmp-fg-disabled)';

  const statusLabel: Record<string, string> = {
    autosave: 'Autosave',
    saved_version: 'Saved version',
    future_update: 'Planned',
    applied: 'Applied'
  };

  const changes = diffSnapshotState(
    snapshot.base_state as SnapshotState | undefined,
    snapshot.proposed_state as SnapshotState | undefined,
    schema,
    lifecycleStates,
    teams
  );

  return (
    <div className={styles.etlDetail}>
      <div className={styles.etlDetailHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.etlDetailName}>
            {isOwn ? 'Own history' : (project?.name ?? 'Project')}
          </div>
          <div className={styles.etlDetailSub}>
            {fmtDate(snapshot.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <button type="button" className={styles.etlDetailCloseBtn} onClick={onClose}>
          <TbX size={12} />
        </button>
      </div>

      <div className={styles.etlDetailBody}>
        <div className={styles.etlDetailStatusRow}>
          <span
            className={styles.etlDetailBadge}
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {statusLabel[snapshot.status] ?? snapshot.status}
          </span>
          {snapshot.target_date && (
            <span className={styles.etlDetailSub}>
              Target: {snapshot.target_date}
            </span>
          )}
        </div>

        {snapshot.commit_message && (
          <div className={styles.etlDetailMsg}>"{snapshot.commit_message}"</div>
        )}

        {changes.length > 0 && (
          <div className={styles.etlDetailChanges}>
            <div className={styles.etlDetailSectionLabel}>Changes</div>
            {changes.map(change => (
              <div key={change.label} className={styles.etlChgRow}>
                <span className={styles.etlChgField}>{change.label}</span>
                <span className={styles.etlChgFrom}>{change.from}</span>
                <span className={styles.etlChgArrow}>→</span>
                <span className={styles.etlChgTo}>{change.to}</span>
              </div>
            ))}
          </div>
        )}

        {project?.name && (
          <div className={styles.etlDetailMeta}>
            <span>{project.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};
