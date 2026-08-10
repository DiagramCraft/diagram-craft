import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { TbCalendarWeek } from 'react-icons/tb';
import styles from './TimelineView.module.css';
import {
  buildTimelineRange,
  getTodayTimelinePx,
  stringDateToTimelinePx
} from '../../../components/timeline/timelineUtils';
import {
  buildContainmentParentNames,
  collectTimelineDates,
  getDatedTimelineRows,
  groupTimelineRows
} from './timelineViewState';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import type { EntityRecord, TimelineViewData } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { Project } from '@arch-register/api-types/projectContract';
import { timelineViewConfigSchema } from '@arch-register/api-types/viewContract';
import { useEntityTimeline } from '../../../hooks/useEntityTimeline';
import { useMilestones } from '../../../hooks/useMilestones';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { EmptyState } from '../../../components/EmptyState';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import { normalizeViewConfig } from './entityViewConfig';
import { getDateFields, type FieldOption } from './entityFieldSources';
import {
  getDateValue,
  getTimelineConfigDefaults,
  type TimelineConfig,
  TL_COL_W,
  METADATA_DATE_FIELDS
} from './timelineViewTypes';
import { TimelineConfigBar } from './TimelineConfigBar';
import { TimelineContent, type TimelineProjectEntityGroup } from './TimelineContent';
import { DetailPanel, SnapDetailPanel } from './TimelineDetailPanels';
import { toChangeCaseEntries, type TimelineDot } from './TimelineSnapshotRows';
import { toMilestonesById } from './snapshotDisplay';

const useDateFieldOptions = (schemas: EntitySchema[]): FieldOption[] =>
  useMemo(() => getDateFields(schemas, METADATA_DATE_FIELDS), [schemas]);

type TimelineViewProps = EntityBrowserRowViewProps & {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  config: unknown;
  onConfigChange: (cfg: TimelineConfig) => void;
  workspaceId: string;
  projects: Project[];
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  hideToolbar?: boolean;
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
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  linkedEntityIds,
  hideToolbar
}: TimelineViewProps) => {
  const dateFields = useDateFieldOptions(schemas);
  const TODAY = useMemo(() => new Date(), []);
  const { data: milestones = [] } = useMilestones(workspaceId);
  const milestonesById = useMemo(() => toMilestonesById(milestones), [milestones]);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);
  const cfg: TimelineConfig = useMemo(() => {
    return normalizeViewConfig(
      timelineViewConfigSchema,
      config,
      getTimelineConfigDefaults(dateFields)
    );
  }, [config, dateFields]);
  const isSnapshotMode = cfg.groupBy === 'snapshot' || cfg.groupBy === 'project';
  const timelineEntityIds = useMemo(
    () => (isSnapshotMode ? rows.map(entity => entity._uid) : []),
    [isSnapshotMode, rows]
  );
  const { data: timelineData } = useEntityTimeline(workspaceId, timelineEntityIds, isSnapshotMode);

  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const [snapDetail, setSnapDetail] = useState<{
    snap: TimelineDot;
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
    () => getDatedTimelineRows(rows, cfg.startFieldId, cfg.endFieldId, getDateValue),
    [rows, cfg.startFieldId, cfg.endFieldId]
  );

  const { treeNodes, treeEdges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    typeFilter,
    ownerFilter,
    statusFilter,
    enabled: cfg.groupBy === 'containment'
  });
  const parentNameByUid = useMemo(
    () => buildContainmentParentNames(treeNodes, treeEdges),
    [treeNodes, treeEdges]
  );

  // Group by owner, type, or containment parent (not used in snapshot mode)
  const groups = useMemo(() => {
    if (cfg.groupBy === 'snapshot' || cfg.groupBy === 'project') return [];
    return groupTimelineRows(datedRows, cfg.groupBy, schemaMap, parentNameByUid);
  }, [datedRows, cfg.groupBy, schemaMap, parentNameByUid]);

  // Date range + columns
  const { rangeStart, rangeEnd, columns, totalWidth } = useMemo(() => {
    const sourceRows = cfg.groupBy === 'snapshot' || cfg.groupBy === 'project' ? rows : datedRows;
    const fallbackDates =
      cfg.groupBy === 'snapshot' || cfg.groupBy === 'project'
        ? [new Date(TODAY.getFullYear() - 1, 0, 1), new Date(TODAY.getFullYear() + 1, 11, 31)]
        : [];
    return buildTimelineRange({
      dates: collectTimelineDates(
        sourceRows,
        cfg.startFieldId,
        cfg.endFieldId,
        getDateValue,
        fallbackDates
      ),
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

  const milestoneMarkers = useMemo(() => {
    if (cfg.groupBy !== 'snapshot' && cfg.groupBy !== 'project') return [];
    return [...milestonesById.values()]
      .map(milestone => ({
        milestone,
        px: stringDateToTimelinePx(milestone.target_date, rangeStart, rangeEnd, totalWidth)
      }))
      .filter((m): m is { milestone: Milestone; px: number } => m.px !== null);
  }, [cfg.groupBy, milestonesById, rangeStart, rangeEnd, totalWidth]);

  const visibleMilestoneMarkers = useMemo(
    () => milestoneMarkers.filter(({ px }) => px > timelineScrollLeft + 1),
    [milestoneMarkers, timelineScrollLeft]
  );
  const visibleTodayPx = todayPx !== null && todayPx > timelineScrollLeft + 1 ? todayPx : null;

  const handleTimelineScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setTimelineScrollLeft(event.currentTarget.scrollLeft);
  }, []);
  const activeEntity = useMemo(
    () =>
      activeEntityId
        ? ((isSnapshotMode ? rows : datedRows).find(e => e._uid === activeEntityId) ?? null)
        : null,
    [activeEntityId, datedRows, rows, isSnapshotMode]
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

  const handleSnapSelect = useCallback((snap: TimelineDot | null, entity: EntityRecord) => {
    setSnapDetail(snap ? { snap, entity } : null);
    setActiveEntityId(null);
  }, []);

  const handleBarClick = useCallback((entity: EntityRecord) => {
    setActiveEntityId(entity._uid);
    setSnapDetail(null);
  }, []);

  const projectEntityGroups = useMemo(() => {
    if (cfg.groupBy !== 'project') return [];

    const entitiesByProject = new Map<string, EntityRecord[]>();
    rows.forEach(entity => {
      const projectIdsForEntity = new Set(
        toChangeCaseEntries(timelineData[entity._uid])
          .map(entry => entry.changeCase.project_id)
          .filter((projectId): projectId is string => projectId != null)
      );
      for (const projectId of projectIdsForEntity) {
        const entities = entitiesByProject.get(projectId);
        if (entities) entities.push(entity);
        else entitiesByProject.set(projectId, [entity]);
      }
    });

    return projects
      .map(project => ({ project, entities: entitiesByProject.get(project.id) ?? [] }))
      .filter(group => group.entities.length > 0);
  }, [cfg.groupBy, projects, rows, timelineData]);
  const isEmpty = isSnapshotMode ? rows.length === 0 : datedRows.length === 0;
  const totalDated = isSnapshotMode ? rows.length : datedRows.length;

  const handleEntityPanelToggle = useCallback((entityId: string) => {
    setActiveEntityId(previous => (previous === entityId ? null : entityId));
  }, []);

  return (
    <div className={styles.screen}>
      {!hideToolbar && (
        <TimelineConfigBar
          cfg={cfg}
          onChange={updateCfg}
          dateFields={dateFields}
          totalDated={totalDated}
          totalRows={rows.length}
          isSnapshotMode={isSnapshotMode}
        />
      )}

      {isEmpty ? (
        <EmptyState
          icon={<TbCalendarWeek size={26} />}
          title={
            isSnapshotMode ? 'No entities in this view' : 'No entities with dates in this view'
          }
          subtitle={
            isSnapshotMode
              ? 'Add entities to see their snapshot history and planned project changes.'
              : 'Select a date field above, or add dates to entities.'
          }
        />
      ) : (
        <TimelineContent
          cfg={cfg}
          rows={rows}
          datedRows={datedRows}
          groups={groups}
          projectEntityGroups={projectEntityGroups as TimelineProjectEntityGroup[]}
          timelineData={timelineData as Record<string, TimelineViewData>}
          projects={projects}
          milestonesById={milestonesById}
          schemaMap={schemaMap}
          lifecycleStates={lifecycleStates}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          totalWidth={totalWidth}
          columns={columns}
          todayPx={todayPx}
          visibleTodayPx={visibleTodayPx}
          visibleMilestoneMarkers={visibleMilestoneMarkers}
          milestoneMarkers={milestoneMarkers}
          today={TODAY}
          linkedEntityIds={linkedEntityIds}
          linkedEntityIdSet={linkedEntityIdSet}
          snapDetail={snapDetail}
          activeEntityId={activeEntityId}
          onTimelineScroll={handleTimelineScroll}
          onSnapSelect={handleSnapSelect}
          onEntityClick={onEntityClick}
          onBarClick={handleBarClick}
          onEntityPanelToggle={handleEntityPanelToggle}
        />
      )}

      <DetailPanel
        entity={activeEntity}
        isLinked={
          activeEntity == null ||
          linkedEntityIds == null ||
          linkedEntityIdSet.has(activeEntity._uid)
        }
        cfg={cfg}
        dateFields={dateFields}
        schemaMap={schemaMap}
        onOpen={() => {
          if (activeEntity) onEntityClick(activeEntity._publicId);
        }}
        onClose={() => setActiveEntityId(null)}
      />

      <SnapDetailPanel
        detail={snapDetail}
        isLinked={
          snapDetail == null ||
          linkedEntityIds == null ||
          linkedEntityIdSet.has(snapDetail.entity._uid)
        }
        projects={projects}
        milestonesById={milestonesById}
        schemaMap={schemaMap}
        lifecycleStates={lifecycleStates}
        onEntityClick={onEntityClick}
        onClose={() => setSnapDetail(null)}
      />
    </div>
  );
};
