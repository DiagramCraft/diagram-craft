import { useMemo } from 'react';
import { TbGitBranch } from 'react-icons/tb';
import styles from './TimelineView.module.css';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { dateToTimelinePx } from '../../../components/timeline/timelineUtils';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type {
  EntityRecord,
  TimelineViewData,
  TimelineVersion
} from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { getSnapshotDateLabel, getSnapshotEffectiveDate } from './snapshotDisplay';
import {
  filterOwnTimelineVersions,
  groupChangeCaseEntriesByProject,
  getOwnVersionDisplayStatus,
  type TimelineChangeCaseEntry
} from './timelineViewState';
import { getDateValue, type TimelineHorizonBand } from './timelineViewTypes';

// ── Timeline dots ─────────────────────────────────────────────────────────────
//
// A dot on the timeline is either an own-history entry (from an EntityVersion) or a
// project-scoped planned/applied entry (from a ChangeCase member). Both render as the same kind
// of marker and share a selection/detail-panel UI, so this local union carries just what the UI
// needs from either source — it isn't a shared "snapshot" API shape.

export type TimelineDot =
  | { source: 'own'; id: string; version: TimelineVersion }
  | { source: 'project'; id: string; entry: TimelineChangeCaseEntry };

export const toChangeCaseEntries = (
  timelineData: TimelineViewData | undefined
): TimelineChangeCaseEntry[] => timelineData?.projectChanges ?? [];

export const dotStatus = (dot: TimelineDot): string =>
  dot.source === 'own'
    ? getOwnVersionDisplayStatus(dot.version.kind)
    : dot.entry.changeCase.status === 'applied'
      ? 'applied'
      : 'future_update';

export const dotCommitMessage = (dot: TimelineDot): string | null =>
  dot.source === 'own' ? dot.version.commit_message : dot.entry.changeCase.commit_message;

export const dotCreatedAt = (dot: TimelineDot): string =>
  dot.source === 'own' ? dot.version.created_at : dot.entry.changeCase.created_at;

export const dotProjectId = (dot: TimelineDot): string | null =>
  dot.source === 'own' ? null : dot.entry.changeCase.project_id;

// ── SnapBlock ─────────────────────────────────────────────────────────────────

type SnapBlockProps = {
  entity: EntityRecord;
  isLinked: boolean;
  timelineData?: TimelineViewData;
  projects: Project[];
  projectFilterId?: string;
  milestonesById: Map<string, Milestone>;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  startFieldId: string | null;
  endFieldId: string | null;
  TODAY: Date;
  lifecycleStates: WorkspaceLifecycleState[];
  selectedSnapId: string | null;
  showProjectLanes: boolean;
  showAutosaves: boolean;
  horizonBands?: TimelineHorizonBand[];
  onSnapSelect: (snap: TimelineDot | null, entity: EntityRecord) => void;
  onEntityClick: (entityId: string) => void;
  onBarClick: (entity: EntityRecord) => void;
};

export const SnapBlock = ({
  entity,
  isLinked,
  timelineData,
  projects,
  milestonesById,
  projectFilterId,
  schemaMap,
  rangeStart,
  rangeEnd,
  totalWidth,
  startFieldId,
  endFieldId,
  TODAY,
  lifecycleStates,
  selectedSnapId,
  showProjectLanes,
  showAutosaves,
  horizonBands,
  onSnapSelect,
  onEntityClick,
  onBarClick
}: SnapBlockProps) => {
  const versions = timelineData?.versions ?? [];
  const changeCaseEntries = useMemo(() => toChangeCaseEntries(timelineData), [timelineData]);

  const ownDots = useMemo<TimelineDot[]>(
    () =>
      filterOwnTimelineVersions(versions, showAutosaves).map(version => ({
        source: 'own',
        id: version.id,
        version
      })),
    [versions, showAutosaves]
  );

  const projectLanes = useMemo(() => {
    const lanes = groupChangeCaseEntriesByProject(changeCaseEntries);
    return lanes.map(lane => ({
      projectId: lane.projectId,
      dots: lane.entries.map(
        (entry): TimelineDot => ({ source: 'project', id: entry.member.id, entry })
      )
    }));
  }, [changeCaseEntries]);
  const visibleProjectLanes = useMemo(
    () =>
      projectFilterId == null
        ? projectLanes
        : projectLanes.filter(({ projectId }) => projectId === projectFilterId),
    [projectFilterId, projectLanes]
  );

  if (projectFilterId != null && visibleProjectLanes.length === 0) return null;

  const projectSnapshots = visibleProjectLanes.flatMap(({ dots }) => dots);
  const projectColor = projectFilterId
    ? (projects.find(project => project.id === projectFilterId)?.color ?? 'var(--accent-fg)')
    : undefined;

  const toPx = (d: Date | null): number => {
    return dateToTimelinePx(d, rangeStart, rangeEnd, totalWidth);
  };

  const s = schemaMap.get(entity._schema.id);
  const barColor =
    lifecycleStates.find(ls => ls.id === entity._lifecycle?.id)?.color ?? 'var(--base-fg-more-dim)';

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
  const renderHorizonFills = () =>
    horizonBands?.map(band => (
      <div
        key={band.id}
        className={styles.horizonFill}
        data-horizon={band.id}
        style={{ left: band.left, width: band.width }}
      />
    ));

  const condensedDots = !showProjectLanes && projectFilterId == null && (
    <>
      <div className={styles.snapBaseline} />
      {[...projectSnapshots, ...ownDots].map(snap => {
        if (snap.source === 'own') {
          const px = toPx(new Date(dotCreatedAt(snap)));
          const isSel = selectedSnapId === snap.id;
          const dotClass =
            dotStatus(snap) === 'saved_version'
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
              title={dotCommitMessage(snap) ?? dotStatus(snap)}
            />
          );
        }
        const effectiveDate = getSnapshotEffectiveDate(snap.entry.changeCase, milestonesById);
        if (!effectiveDate) return null;
        const px = toPx(new Date(`${effectiveDate}T00:00:00`));
        const isSel = selectedSnapId === snap.id;
        const status = dotStatus(snap);
        const dotClass = status === 'applied' ? styles.snapDotApplied : styles.snapDotFutureUpdate;
        const dateLabel = getSnapshotDateLabel(snap.entry.changeCase, milestonesById);
        const commitMessage = dotCommitMessage(snap);
        return (
          <div
            key={snap.id}
            className={`${styles.snapDot} ${dotClass} ${isSel ? styles.snapDotSelected : ''}`}
            style={{ left: px, '--snap-color': projectColor } as React.CSSProperties}
            onClick={ev => {
              ev.stopPropagation();
              onSnapSelect(isSel ? null : snap, entity);
            }}
            title={commitMessage ? `${commitMessage} (${dateLabel})` : (dateLabel ?? status)}
          />
        );
      })}
    </>
  );

  return (
    <div className={styles.snapBlock}>
      {/* Entity header row */}
      <div className={styles.snapHeader}>
        <div
          className={`${styles.labelCol} ${styles.labelColClickable}`}
          onClick={() => onEntityClick(entity._publicId)}
        >
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
          <span
            className={styles.entityOwner}
            title={`Owner: ${entity._owner?.name ?? 'Unassigned'}`}
          >
            {entity._owner?.name ?? 'Unassigned'}
          </span>
          {entity._lifecycle && (
            <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
        </div>
        <div className={styles.barCell} style={{ width: totalWidth }}>
          {renderHorizonFills()}
          {projectFilterId != null ? (
            <>
              <div className={styles.snapBaseline} />
              {projectSnapshots.map(snap => {
                if (snap.source !== 'project') return null;
                const effectiveDate = getSnapshotEffectiveDate(
                  snap.entry.changeCase,
                  milestonesById
                );
                if (!effectiveDate) return null;
                const px = toPx(new Date(`${effectiveDate}T00:00:00`));
                const isSel = selectedSnapId === snap.id;
                const status = dotStatus(snap);
                const dotClass =
                  status === 'applied' ? styles.snapDotApplied : styles.snapDotFutureUpdate;
                const dateLabel = getSnapshotDateLabel(snap.entry.changeCase, milestonesById);
                const commitMessage = dotCommitMessage(snap);
                return (
                  <div
                    key={snap.id}
                    className={`${styles.snapDot} ${dotClass} ${isSel ? styles.snapDotSelected : ''}`}
                    style={{ left: px, '--snap-color': projectColor } as React.CSSProperties}
                    onClick={ev => {
                      ev.stopPropagation();
                      onSnapSelect(isSel ? null : snap, entity);
                    }}
                    title={
                      commitMessage ? `${commitMessage} (${dateLabel})` : (dateLabel ?? status)
                    }
                  />
                );
              })}
            </>
          ) : !isMilestone && startD ? (
            <div
              className={`${styles.bar} ${!endD ? styles.barOpen : ''}`}
              style={{ left: barLeft, width: barWidth, background: barColor }}
              onClick={ev => {
                ev.stopPropagation();
                onBarClick(entity);
              }}
            />
          ) : isMilestone ? (
            <div
              className={styles.milestone}
              style={{ left: milestoneX, background: barColor }}
              onClick={ev => {
                ev.stopPropagation();
                onBarClick(entity);
              }}
            />
          ) : null}
          {condensedDots}
        </div>
      </div>

      {/* Own history lane */}
      {(projectFilterId != null || showProjectLanes) && ownDots.length > 0 && (
        <div className={`${styles.snapLane} ${styles.snapLaneOwn}`}>
          <div className={`${styles.labelCol} ${styles.snapLaneLabel}`}>
            <TbGitBranch size={10} style={{ color: 'var(--base-fg-more-dim)', flexShrink: 0 }} />
            <span>Own history</span>
          </div>
          <div className={`${styles.barCell} ${styles.snapTrack}`} style={{ width: totalWidth }}>
            {renderHorizonFills()}
            <div className={styles.snapBaseline} />
            {ownDots.map(snap => {
              const px = toPx(new Date(dotCreatedAt(snap)));
              const isSel = selectedSnapId === snap.id;
              const status = dotStatus(snap);
              const dotClass =
                status === 'saved_version' ? styles.snapDotSavedVersion : styles.snapDotAutosave;
              return (
                <div
                  key={snap.id}
                  className={`${styles.snapDot} ${dotClass} ${isSel ? styles.snapDotSelected : ''}`}
                  style={{ left: px }}
                  onClick={ev => {
                    ev.stopPropagation();
                    onSnapSelect(isSel ? null : snap, entity);
                  }}
                  title={dotCommitMessage(snap) ?? status}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Project lanes */}
      {projectFilterId == null &&
        showProjectLanes &&
        visibleProjectLanes.map(({ projectId, dots }) => {
          const project = projects.find(p => p.id === projectId);
          if (!project) return null;
          const projectColor = project.color ?? 'var(--accent-fg)';
          return (
            <div key={projectId} className={styles.snapLane}>
              <div className={`${styles.labelCol} ${styles.snapLaneLabel}`}>
                <span className={styles.snapProjDot} style={{ background: projectColor }} />
                <span>{project.name}</span>
              </div>
              <div
                className={`${styles.barCell} ${styles.snapTrack}`}
                style={{ width: totalWidth }}
              >
                {renderHorizonFills()}
                <div className={styles.snapBaseline} />
                {dots.map(snap => {
                  if (snap.source !== 'project') return null;
                  const effectiveDate = getSnapshotEffectiveDate(
                    snap.entry.changeCase,
                    milestonesById
                  );
                  if (!effectiveDate) return null;
                  const px = toPx(new Date(`${effectiveDate}T00:00:00`));
                  const isSel = selectedSnapId === snap.id;
                  const status = dotStatus(snap);
                  const dotClass =
                    status === 'applied' ? styles.snapDotApplied : styles.snapDotFutureUpdate;
                  const dateLabel = getSnapshotDateLabel(snap.entry.changeCase, milestonesById);
                  const commitMessage = dotCommitMessage(snap);
                  return (
                    <div
                      key={snap.id}
                      className={`${styles.snapDot} ${dotClass} ${isSel ? styles.snapDotSelected : ''}`}
                      style={{ left: px, '--snap-color': projectColor } as React.CSSProperties}
                      onClick={ev => {
                        ev.stopPropagation();
                        onSnapSelect(isSel ? null : snap, entity);
                      }}
                      title={
                        commitMessage ? `${commitMessage} (${dateLabel})` : (dateLabel ?? status)
                      }
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
