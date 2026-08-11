import type { UIEvent } from 'react';
import styles from './TimelineView.module.css';
import { TimelineScaffold } from '../../../components/timeline/TimelineScaffold';
import {
  dateToTimelinePx,
  formatTimelineDate,
  stringDateToTimelinePx
} from '../../../components/timeline/timelineUtils';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { StatusChip } from '../../../components/StatusChip';
import { TypeBadge } from '../../../components/TypeBadge';
import type { EntityRecord, TimelineViewData } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { Project } from '@arch-register/api-types/projectContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { SnapBlock, type TimelineDot } from './TimelineSnapshotRows';
import {
  getDateValue,
  getRawDateValue,
  type TimelineHorizonBand,
  type TimelineConfig,
  TL_LABEL_W
} from './timelineViewTypes';

export type TimelineProjectEntityGroup = {
  project: Project;
  entities: EntityRecord[];
};

type TimelineContentProps = {
  cfg: TimelineConfig;
  rows: EntityRecord[];
  datedRows: EntityRecord[];
  groups: [string, EntityRecord[]][];
  undatedRows: EntityRecord[];
  undatedGroups: [string, EntityRecord[]][];
  projectEntityGroups: TimelineProjectEntityGroup[];
  timelineData: Record<string, TimelineViewData>;
  projects: Project[];
  milestonesById: Map<string, Milestone>;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
  columns: Array<{ label: string; width: number; isCurrent: boolean }>;
  todayPx: number | null;
  visibleTodayPx: number | null;
  visibleMilestoneMarkers: Array<{ milestone: Milestone; px: number }>;
  milestoneMarkers: Array<{ milestone: Milestone; px: number }>;
  horizonBands: TimelineHorizonBand[];
  today: Date;
  linkedEntityIds?: string[];
  linkedEntityIdSet: Set<string>;
  snapDetail: { snap: TimelineDot; entity: EntityRecord } | null;
  activeEntityId: string | null;
  onTimelineScroll: (event: UIEvent<HTMLDivElement>) => void;
  onSnapSelect: (snap: TimelineDot | null, entity: EntityRecord) => void;
  onEntityClick: (entityId: string) => void;
  onBarClick: (entity: EntityRecord) => void;
  onEntityPanelToggle: (entityId: string) => void;
};

export const TimelineContent = ({
  cfg,
  rows,
  datedRows,
  groups,
  undatedRows,
  undatedGroups,
  projectEntityGroups,
  timelineData,
  projects,
  milestonesById,
  schemaMap,
  lifecycleStates,
  rangeStart,
  rangeEnd,
  totalWidth,
  columns,
  todayPx,
  visibleTodayPx,
  visibleMilestoneMarkers,
  milestoneMarkers,
  horizonBands,
  today,
  linkedEntityIds,
  linkedEntityIdSet,
  snapDetail,
  activeEntityId,
  onTimelineScroll,
  onSnapSelect,
  onEntityClick,
  onBarClick,
  onEntityPanelToggle
}: TimelineContentProps) => {
  const isEventMode =
    cfg.groupBy === 'snapshot' || cfg.groupBy === 'project' || cfg.groupBy === 'capability';
  const isCapabilityMode = cfg.groupBy === 'capability';
  const renderSnapBlock = (entity: EntityRecord, projectFilterId?: string) => (
    <SnapBlock
      key={`${projectFilterId ?? 'all'}-${entity._uid}`}
      entity={entity}
      timelineData={timelineData[entity._uid]}
      projects={projects}
      projectFilterId={projectFilterId}
      milestonesById={milestonesById}
      schemaMap={schemaMap}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      totalWidth={totalWidth}
      startFieldId={cfg.startFieldId}
      endFieldId={cfg.endFieldId}
      TODAY={today}
      lifecycleStates={lifecycleStates}
      isLinked={linkedEntityIds == null || linkedEntityIdSet.has(entity._uid)}
      selectedSnapId={snapDetail?.snap.id ?? null}
      showProjectLanes={cfg.showProjectLanes}
      showAutosaves={cfg.showAutosaves}
      horizonBands={horizonBands}
      onSnapSelect={onSnapSelect}
      onEntityClick={onEntityClick}
      onBarClick={onBarClick}
    />
  );

  const renderHorizonFills = () =>
    horizonBands.map(band => (
      <div
        key={band.id}
        className={styles.horizonFill}
        data-horizon={band.id}
        style={{ left: band.left, width: band.width }}
      />
    ));

  const renderCapabilityGroups = (groupList: [string, EntityRecord[]][]) =>
    groupList.map(([groupKey, entities]) => (
      <div key={groupKey}>
        <div className={styles.groupRow}>
          <div className={`${styles.labelCol} ${styles.groupLabelCol}`}>
            {groupKey}
            <span className={styles.groupCount}>({entities.length})</span>
          </div>
          <div className={styles.groupSpacer} style={{ width: totalWidth }}>
            {renderHorizonFills()}
          </div>
        </div>
        {entities.map(entity => renderSnapBlock(entity))}
      </div>
    ));

  return (
    <TimelineScaffold
      scrollClassName={styles.scrollWrap}
      onScroll={onTimelineScroll}
      labelWidth={TL_LABEL_W}
      totalWidth={totalWidth}
      todayPx={todayPx}
      todayScrollAlign={0.38}
      header={
        <>
          <div className={styles.headerRow}>
            <div className={`${styles.labelCol} ${styles.labelColHeader}`}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                {isEventMode ? `${rows.length} entities` : `${datedRows.length} entities`}
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
          {horizonBands.length > 0 && (
            <div className={styles.horizonRow}>
              <div className={`${styles.labelCol} ${styles.labelColHeader}`}>Horizon</div>
              <div className={styles.horizonTrack} style={{ width: totalWidth }}>
                {horizonBands.map(band => (
                  <div
                    key={band.id}
                    className={styles.horizonBand}
                    style={{ left: band.left, width: band.width }}
                  >
                    {band.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      }
      todayLine={
        visibleTodayPx === null ? null : (
          <div className={styles.todayLine} style={{ left: TL_LABEL_W + visibleTodayPx }}>
            <span className={styles.todayPip}>▾</span>
          </div>
        )
      }
      overlayLines={
        cfg.showMilestones && (cfg.groupBy === 'snapshot' || isCapabilityMode)
          ? visibleMilestoneMarkers.map(({ milestone, px }) => {
              const projectName = projects.find(
                project => project.id === milestone.project_id
              )?.name;
              const milestoneTitle = `${milestone.name}${projectName ? ` · ${projectName}` : ''} (${milestone.target_date})`;
              return (
                <div
                  key={milestone.id}
                  role="img"
                  className={styles.milestoneLine}
                  style={{
                    left: TL_LABEL_W + px,
                    top: cfg.groupBy === 'snapshot' || isCapabilityMode ? 52 : undefined
                  }}
                  title={milestoneTitle}
                  aria-label={`Milestone: ${milestoneTitle}`}
                >
                  <span className={styles.milestoneLabel} title={milestoneTitle}>
                    {milestone.name}
                  </span>
                </div>
              );
            })
          : null
      }
    >
      {cfg.showMilestones &&
        (cfg.groupBy === 'snapshot' || isCapabilityMode) &&
        milestoneMarkers.length > 0 && (
          <div className={styles.milestoneLane}>
            <div className={styles.milestoneLaneCorner}>Milestones</div>
            <div className={styles.milestoneLaneTrack} style={{ width: totalWidth }}>
              {renderHorizonFills()}
            </div>
          </div>
        )}

      {/* Standard groups (owner / type) */}
      {!isEventMode &&
        groups.map(([groupKey, entities]) => (
          <div key={groupKey}>
            {/* Group header */}
            <div className={styles.groupRow}>
              <div className={`${styles.labelCol} ${styles.groupLabelCol}`}>
                {groupKey}
                <span className={styles.groupCount}>({entities.length})</span>
              </div>
              <div className={styles.groupSpacer} style={{ width: totalWidth }}>
                {renderHorizonFills()}
              </div>
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
                const endX = dateToTimelinePx(endD ?? today, rangeStart, rangeEnd, totalWidth);
                barWidth = Math.max(6, endX - barLeft);
              }
              const milestoneX = isMilestone
                ? dateToTimelinePx(endD, rangeStart, rangeEnd, totalWidth)
                : 0;

              const togglePanel = (ev: React.MouseEvent) => {
                ev.stopPropagation();
                onEntityPanelToggle(e._uid);
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
                    {renderHorizonFills()}
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

      {/* Project mode: one block per project, with an entity block in each project lane */}
      {cfg.groupBy === 'project'
        ? projectEntityGroups.map(({ project, entities }) => (
            <div key={project.id} className={styles.projectGroup}>
              {cfg.showMilestones &&
                visibleMilestoneMarkers
                  .filter(({ milestone }) => milestone.project_id === project.id)
                  .map(({ milestone, px }) => {
                    const milestoneTitle = `${milestone.name} · ${project.name} (${milestone.target_date})`;
                    return (
                      <div
                        key={milestone.id}
                        role="img"
                        className={styles.projectMilestoneLine}
                        style={{ left: TL_LABEL_W + px }}
                        title={milestoneTitle}
                        aria-label={`Milestone: ${milestoneTitle}`}
                      >
                        <span className={styles.projectMilestoneLabel} title={milestoneTitle}>
                          {milestone.name}
                        </span>
                      </div>
                    );
                  })}
              <div className={styles.groupRow}>
                <div className={`${styles.labelCol} ${styles.groupLabelCol}`}>
                  {project.name}
                  <span className={styles.groupCount}>({entities.length})</span>
                </div>
                <div className={styles.groupSpacer} style={{ width: totalWidth }}>
                  {renderHorizonFills()}
                  {project.start_date && project.target_date
                    ? (() => {
                        const barLeft = stringDateToTimelinePx(
                          project.start_date,
                          rangeStart,
                          rangeEnd,
                          totalWidth
                        );
                        const barRight = stringDateToTimelinePx(
                          project.target_date,
                          rangeStart,
                          rangeEnd,
                          totalWidth
                        );
                        if (barLeft == null || barRight == null) return null;
                        return (
                          <div
                            className={styles.bar}
                            style={{
                              left: barLeft,
                              width: Math.max(6, barRight - barLeft),
                              background: project.color ?? 'var(--base-fg-more-dim)'
                            }}
                            title={`${project.name} · ${formatTimelineDate(project.start_date)} → ${formatTimelineDate(project.target_date)}`}
                          />
                        );
                      })()
                    : null}
                </div>
              </div>
              {entities.map(entity => renderSnapBlock(entity, project.id))}
            </div>
          ))
        : cfg.groupBy === 'snapshot' && rows.map(entity => renderSnapBlock(entity))}

      {/* Capability mode: dated rows are grouped by containment parent, while undated rows stay
          visible in their own section rather than disappearing from the strategic view. */}
      {isCapabilityMode && (
        <>
          {renderCapabilityGroups(groups)}
          {undatedRows.length > 0 && (
            <div className={styles.undatedSection}>
              <div className={styles.undatedHeader}>
                <div className={`${styles.labelCol} ${styles.groupLabelCol}`}>
                  Undated
                  <span className={styles.groupCount}>({undatedRows.length})</span>
                </div>
                <div className={styles.groupSpacer} style={{ width: totalWidth }}>
                  {renderHorizonFills()}
                </div>
              </div>
              {renderCapabilityGroups(undatedGroups)}
            </div>
          )}
        </>
      )}
    </TimelineScaffold>
  );
};
