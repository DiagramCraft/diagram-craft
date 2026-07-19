import { useState, useMemo } from 'react';
import { TbX } from 'react-icons/tb';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Project, ProjectEntity } from '@arch-register/api-types/projectContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import {
  SnapshotTimelineShell,
  useSnapshotTimeline
} from '../../../components/timeline/SnapshotTimeline';
import {
  formatTimelineDate,
  stringDateToTimelinePx,
  type TimelineColumnWidths,
  type TimelineZoom
} from '../../../components/timeline/timelineUtils';
import styles from '../EntityDetailScreen.module.css';
import { detectConflicts, diffSnapshotState, type SnapshotState } from './entityTimelineHelpers';
import { EmptyState } from '../../../components/EmptyState';
import { useMilestonesForProjects } from '../../../hooks/useMilestones';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import {
  getSnapshotDateLabel,
  getSnapshotEffectiveDate,
  toMilestonesById
} from './snapshotDisplay';

type EntityProject = { project: Project; entity_type: ProjectEntity['entity_type'] };

const LABEL_W = 200;
const COL_W: TimelineColumnWidths = { month: 72, quarter: 100, year: 136 };

// ── Main component ─────────────────────────────────────────────────────────────
export const EntityTimelineTab = ({
  workspaceId,
  allSnapshots,
  entityProjects,
  schema,
  lifecycleStates,
  teams
}: {
  workspaceId: string;
  allSnapshots: EntitySnapshot[];
  entityProjects: EntityProject[];
  schema: EntitySchema | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const [zoom, setZoom] = useState<TimelineZoom>('quarter');
  const [selectedSnap, setSelectedSnap] = useState<EntitySnapshot | null>(null);
  const TODAY = useMemo(() => new Date(), []);
  const projectIds = useMemo(() => entityProjects.map(ep => ep.project.id), [entityProjects]);
  const milestoneQueries = useMilestonesForProjects(workspaceId, projectIds);
  const milestonesById = useMemo(
    () => toMilestonesById(milestoneQueries.flatMap(q => q.data ?? [])),
    [milestoneQueries]
  );

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

  const timelineMilestonesById = useMemo(() => {
    const timelineProjectIds = new Set(projectLanes.map(({ projectId }) => projectId));
    return new Map(
      [...milestonesById].filter(([, milestone]) => timelineProjectIds.has(milestone.project_id))
    );
  }, [milestonesById, projectLanes]);

  const { conflictedProjectIds, conflictedSnapIds } = useMemo(
    () => detectConflicts(allSnapshots),
    [allSnapshots]
  );

  const projectMap = useMemo(
    () => new Map(entityProjects.map(ep => [ep.project.id, ep.project])),
    [entityProjects]
  );

  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    for (const s of ownSnaps) if (s.created_at) dates.push(new Date(s.created_at));
    for (const { snaps } of projectLanes) {
      for (const s of snaps) {
        if (s.created_at) dates.push(new Date(s.created_at));
        const effectiveDate = getSnapshotEffectiveDate(s, timelineMilestonesById);
        if (effectiveDate) dates.push(new Date(`${effectiveDate}T00:00:00`));
      }
    }
    return dates;
  }, [ownSnaps, projectLanes, timelineMilestonesById]);

  const timeline = useSnapshotTimeline({
    dates: timelineDates,
    zoom,
    columnWidths: COL_W,
    milestones: timelineMilestonesById,
    today: TODAY
  });

  const handleSelect = (snap: EntitySnapshot | null) => {
    setSelectedSnap(prev => (snap?.id === prev?.id ? null : snap));
  };

  const hasData = ownSnaps.length > 0 || projectLanes.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        title="No snapshot history yet"
        subtitle="Snapshots are created automatically when the entity is saved."
      />
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
          {ownSnaps.length} own · {projectLanes.length} project
          {projectLanes.length !== 1 ? 's' : ''}
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
        <SnapshotTimelineShell
          context={timeline}
          scrollClassName={styles.etlScroll}
          innerClassName={styles.etlInner}
          labelWidth={LABEL_W}
          classes={{
            head: styles.etlHead,
            corner: styles.etlCorner,
            cornerLabel: styles.etlCornerLabel,
            columns: styles.etlCols,
            column: styles.etlCol,
            currentColumn: styles.etlColNow,
            today: styles.etlToday,
            todayPip: styles.etlTodayPip,
            milestoneLine: styles.etlMilestoneLine,
            milestoneLabel: styles.etlMilestoneLabel
          }}
          cornerLabel="Lanes"
          todayScrollAlign={0.5}
        >
          {timeline.milestoneMarkers.length > 0 && (
            <div className={styles.etlMilestoneLane}>
              <div className={styles.etlMilestoneLaneCorner}>Milestones</div>
              <div
                className={styles.etlMilestoneLaneTrack}
                style={{ width: timeline.totalWidth }}
              />
            </div>
          )}

          {ownSnaps.length > 0 && (
            <OwnHistoryLane
              snaps={ownSnaps}
              rangeStart={timeline.rangeStart}
              rangeEnd={timeline.rangeEnd}
              totalWidth={timeline.totalWidth}
              selectedId={selectedSnap?.id}
              onSelect={handleSelect}
            />
          )}

          {projectLanes.map(({ projectId, snaps }) => (
            <ProjectLane
              key={projectId}
              project={projectMap.get(projectId) ?? null}
              snaps={snaps}
              isConflicted={conflictedProjectIds.has(projectId)}
              conflictedSnapIds={conflictedSnapIds}
              milestonesById={timelineMilestonesById}
              rangeStart={timeline.rangeStart}
              rangeEnd={timeline.rangeEnd}
              totalWidth={timeline.totalWidth}
              selectedId={selectedSnap?.id}
              onSelect={handleSelect}
            />
          ))}
        </SnapshotTimelineShell>

        {selectedSnap && (
          <SnapDetail
            snapshot={selectedSnap}
            project={projectMap.get(selectedSnap.project_id ?? '') ?? null}
            milestonesById={timelineMilestonesById}
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
        const px = stringDateToTimelinePx(snap.created_at, rangeStart, rangeEnd, totalWidth);
        if (px === null) return null;
        const isSaved = snap.status === 'saved_version';
        const isSelected = selectedId === snap.id;
        const dotClass =
          snap.status === 'autosave' ? styles.etlDotAutosave : styles.etlDotSavedVersion;
        return (
          <div
            key={snap.id}
            className={`${styles.etlDot} ${dotClass} ${isSelected ? styles.etlDotSelected : ''}`}
            style={{ left: px }}
            onClick={() => onSelect(isSelected ? null : snap)}
            title={
              snap.commit_message ??
              formatTimelineDate(snap.created_at, { month: 'short', year: 'numeric' })
            }
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
  milestonesById,
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
  milestonesById: Map<string, Milestone>;
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  selectedId: string | undefined;
  onSelect: (snap: EntitySnapshot | null) => void;
}) => {
  const [collapsed, setCollapsed] = useState(false);

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
        <span
          className={styles.etlChevron}
          style={{ transform: collapsed ? 'none' : 'rotate(90deg)' }}
        >
          ›
        </span>
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
            const dateStr =
              snap.status === 'future_update' || snap.status === 'applied'
                ? (getSnapshotEffectiveDate(snap, milestonesById) ?? snap.created_at)
                : snap.created_at;
            const px = stringDateToTimelinePx(dateStr, rangeStart, rangeEnd, totalWidth);
            if (px === null) return null;
            const isSelected = selectedId === snap.id;
            const isSnapConflict = conflictedSnapIds.has(snap.id);
            const dotClass =
              snap.status === 'applied' ? styles.etlDotApplied : styles.etlDotFutureUpdate;
            const dateLabel = getSnapshotDateLabel(snap, milestonesById);
            return (
              <div
                key={snap.id}
                className={`${styles.etlDot} ${dotClass} ${isSelected ? styles.etlDotSelected : ''} ${isSnapConflict ? styles.etlDotConflict : ''}`}
                style={{ left: px }}
                onClick={() => onSelect(isSelected ? null : snap)}
                title={
                  snap.commit_message
                    ? `${snap.commit_message} (${dateLabel})`
                    : (dateLabel ?? snap.status)
                }
              >
                <div
                  className={styles.etlDotInner}
                  style={
                    snap.status === 'future_update' && projectColor
                      ? { background: projectColor }
                      : undefined
                  }
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
  milestonesById,
  schema,
  lifecycleStates,
  teams,
  onClose
}: {
  snapshot: EntitySnapshot;
  project: Project | null;
  milestonesById: Map<string, Milestone>;
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
            {formatTimelineDate(snapshot.created_at, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
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
          {getSnapshotDateLabel(snapshot, milestonesById) && (
            <span className={styles.etlDetailSub}>
              {snapshot.milestone_id ? 'Milestone' : 'Target'}:{' '}
              {getSnapshotDateLabel(snapshot, milestonesById)}
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
