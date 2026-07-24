import { useState, useMemo } from 'react';
import { TbX } from 'react-icons/tb';
import type { EntityVersion } from '@arch-register/api-types/entityVersionContract';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
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
  toMilestonesById,
  flattenChangeCaseMembers,
  type ChangeCaseMemberEntry
} from './snapshotDisplay';
import { getOwnTimelineVersions, getOwnVersionDisplayStatus } from './timelineViewState';

type EntityProject = { project: Project; entity_type: ProjectEntity['entity_type'] };

const LABEL_W = 200;
const COL_W: TimelineColumnWidths = { month: 72, quarter: 100, year: 136 };

// A timeline entry is either an own-history entry (from an EntityVersion) or a project-scoped
// planned/applied entry (from a ChangeCase member). See TimelineView.tsx's equivalent local union
// for why this isn't a shared "snapshot" API shape.
type SnapEntry =
  | { source: 'own'; id: string; version: EntityVersion }
  | { source: 'project'; id: string; entry: ChangeCaseMemberEntry };

const entryStatus = (entry: SnapEntry): string =>
  entry.source === 'own'
    ? getOwnVersionDisplayStatus(entry.version.kind)
    : entry.entry.changeCase.status === 'applied'
      ? 'applied'
      : 'future_update';

const entryCommitMessage = (entry: SnapEntry): string | null =>
  entry.source === 'own' ? entry.version.commit_message : entry.entry.changeCase.commit_message;

const entryCreatedAt = (entry: SnapEntry): string =>
  entry.source === 'own' ? entry.version.created_at : entry.entry.changeCase.created_at;

const entryProjectId = (entry: SnapEntry): string | null =>
  entry.source === 'own' ? null : entry.entry.changeCase.project_id;

// ── Main component ─────────────────────────────────────────────────────────────
export const EntityTimelineTab = ({
  workspaceId,
  versions,
  changeCases,
  entityProjects,
  schema,
  lifecycleStates,
  teams
}: {
  workspaceId: string;
  versions: EntityVersion[];
  changeCases: ChangeCase[];
  entityProjects: EntityProject[];
  schema: EntitySchema | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const [zoom, setZoom] = useState<TimelineZoom>('quarter');
  const [selectedSnap, setSelectedSnap] = useState<SnapEntry | null>(null);
  const TODAY = useMemo(() => new Date(), []);
  const projectIds = useMemo(() => entityProjects.map(ep => ep.project.id), [entityProjects]);
  const milestoneQueries = useMilestonesForProjects(workspaceId, projectIds);
  const milestonesById = useMemo(
    () => toMilestonesById(milestoneQueries.flatMap(q => q.data ?? [])),
    [milestoneQueries]
  );

  const ownSnaps = useMemo<SnapEntry[]>(
    () =>
      getOwnTimelineVersions(versions).map(version => ({
        source: 'own',
        id: version.id,
        version
      })),
    [versions]
  );

  const changeCaseEntries = useMemo(() => flattenChangeCaseMembers(changeCases), [changeCases]);

  const projectLanes = useMemo(() => {
    const byP = new Map<string, SnapEntry[]>();
    for (const entry of changeCaseEntries) {
      const projectId = entry.changeCase.project_id;
      if (!projectId) continue;
      const snapEntry: SnapEntry = { source: 'project', id: entry.member.id, entry };
      const list = byP.get(projectId);
      if (list) list.push(snapEntry);
      else byP.set(projectId, [snapEntry]);
    }
    return [...byP.entries()].map(([projectId, snaps]) => ({ projectId, snaps }));
  }, [changeCaseEntries]);

  const timelineMilestonesById = useMemo(() => {
    const timelineProjectIds = new Set(projectLanes.map(({ projectId }) => projectId));
    return new Map(
      [...milestonesById].filter(([, milestone]) => timelineProjectIds.has(milestone.project_id))
    );
  }, [milestonesById, projectLanes]);

  const { conflictedProjectIds, conflictedSnapIds } = useMemo(
    () => detectConflicts(changeCaseEntries),
    [changeCaseEntries]
  );

  const projectMap = useMemo(
    () => new Map(entityProjects.map(ep => [ep.project.id, ep.project])),
    [entityProjects]
  );

  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    for (const s of ownSnaps) dates.push(new Date(entryCreatedAt(s)));
    for (const { snaps } of projectLanes) {
      for (const s of snaps) {
        if (s.source !== 'project') continue;
        dates.push(new Date(entryCreatedAt(s)));
        const effectiveDate = getSnapshotEffectiveDate(s.entry.changeCase, timelineMilestonesById);
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

  const handleSelect = (snap: SnapEntry | null) => {
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
            project={projectMap.get(entryProjectId(selectedSnap) ?? '') ?? null}
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
  snaps: SnapEntry[];
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  selectedId: string | undefined;
  onSelect: (snap: SnapEntry | null) => void;
}) => (
  <div className={`${styles.etlLane} ${styles.etlLaneOwn}`}>
    <div className={`${styles.etlLaneLabel} ${styles.etlLaneOwnLabel}`}>
      <span className={styles.etlLaneName}>Own history</span>
      <span className={styles.etlLaneDim}>({snaps.length})</span>
    </div>
    <div className={`${styles.etlTrack} ${styles.etlTrackOwn}`} style={{ width: totalWidth }}>
      <div className={styles.etlBaseline} />
      {snaps.map(snap => {
        const createdAt = entryCreatedAt(snap);
        const px = stringDateToTimelinePx(createdAt, rangeStart, rangeEnd, totalWidth);
        if (px === null) return null;
        const status = entryStatus(snap);
        const isSaved = status === 'saved_version';
        const isSelected = selectedId === snap.id;
        const commitMessage = entryCommitMessage(snap);
        const dotClass = status === 'autosave' ? styles.etlDotAutosave : styles.etlDotSavedVersion;
        return (
          <div
            key={snap.id}
            className={`${styles.etlDot} ${dotClass} ${isSelected ? styles.etlDotSelected : ''}`}
            style={{ left: px }}
            onClick={() => onSelect(isSelected ? null : snap)}
            title={
              commitMessage ?? formatTimelineDate(createdAt, { month: 'short', year: 'numeric' })
            }
          >
            <div className={styles.etlDotInner} />
            {isSaved && commitMessage && <div className={styles.etlDotLabel}>{commitMessage}</div>}
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
  snaps: SnapEntry[];
  isConflicted: boolean;
  conflictedSnapIds: Set<string>;
  milestonesById: Map<string, Milestone>;
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  selectedId: string | undefined;
  onSelect: (snap: SnapEntry | null) => void;
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const futureCt = snaps.filter(s => entryStatus(s) === 'future_update').length;
  const appliedCt = snaps.filter(s => entryStatus(s) === 'applied').length;
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
            if (snap.source !== 'project') return null;
            const status = entryStatus(snap);
            const dateStr =
              getSnapshotEffectiveDate(snap.entry.changeCase, milestonesById) ??
              entryCreatedAt(snap);
            const px = stringDateToTimelinePx(dateStr, rangeStart, rangeEnd, totalWidth);
            if (px === null) return null;
            const isSelected = selectedId === snap.id;
            const isSnapConflict = conflictedSnapIds.has(snap.id);
            const dotClass =
              status === 'applied' ? styles.etlDotApplied : styles.etlDotFutureUpdate;
            const dateLabel = getSnapshotDateLabel(snap.entry.changeCase, milestonesById);
            const commitMessage = entryCommitMessage(snap);
            return (
              <div
                key={snap.id}
                className={`${styles.etlDot} ${dotClass} ${isSelected ? styles.etlDotSelected : ''} ${isSnapConflict ? styles.etlDotConflict : ''}`}
                style={{ left: px }}
                onClick={() => onSelect(isSelected ? null : snap)}
                title={commitMessage ? `${commitMessage} (${dateLabel})` : (dateLabel ?? status)}
              >
                <div
                  className={styles.etlDotInner}
                  style={
                    status === 'future_update' && projectColor
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
  snapshot: SnapEntry;
  project: Project | null;
  milestonesById: Map<string, Milestone>;
  schema: EntitySchema | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  onClose: () => void;
}) => {
  const status = entryStatus(snapshot);
  const isFuture = status === 'future_update';
  const isApplied = status === 'applied';
  const isOwn = snapshot.source === 'own';

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

  const changes =
    snapshot.source === 'project'
      ? diffSnapshotState(
          snapshot.entry.member.base_state as SnapshotState | undefined,
          snapshot.entry.member.proposed_state as SnapshotState | undefined,
          schema,
          lifecycleStates,
          teams
        )
      : [];

  return (
    <div className={styles.etlDetail}>
      <div className={styles.etlDetailHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.etlDetailName}>
            {isOwn ? 'Own history' : (project?.name ?? 'Project')}
          </div>
          <div className={styles.etlDetailSub}>
            {formatTimelineDate(entryCreatedAt(snapshot), {
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
            {statusLabel[status] ?? status}
          </span>
          {snapshot.source === 'project' &&
            getSnapshotDateLabel(snapshot.entry.changeCase, milestonesById) && (
              <span className={styles.etlDetailSub}>
                {snapshot.entry.changeCase.milestone_id ? 'Milestone' : 'Target'}:{' '}
                {getSnapshotDateLabel(snapshot.entry.changeCase, milestonesById)}
              </span>
            )}
        </div>

        {entryCommitMessage(snapshot) && (
          <div className={styles.etlDetailMsg}>"{entryCommitMessage(snapshot)}"</div>
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
