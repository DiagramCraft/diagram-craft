import { useState, useMemo } from 'react';
import { TbPencil, TbTrash, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  ProjectDetail as ProjectDetailData,
  ProjectEntity
} from '@arch-register/api-types/projectContract';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import {
  SnapshotTimelineShell,
  useSnapshotTimeline
} from '../../components/timeline/SnapshotTimeline';
import {
  formatTimelineDate,
  stringDateToTimelinePx,
  type TimelineColumnWidths,
  type TimelineZoom
} from '../../components/timeline/timelineUtils';
import { TypeBadge } from '../../components/TypeBadge';
import { diffSnapshotState } from '../entities/components/entityTimelineHelpers';
import {
  getSnapshotDateLabel,
  getSnapshotEffectiveDate
} from '../entities/components/snapshotDisplay';
import styles from './ProjectDetailScreen.module.css';

type SchemaInfo = { color: string; icon: string | null };

const LABEL_W = 248;
const COL_W: TimelineColumnWidths = { month: 72, quarter: 100, year: 136 };

// ── Main component ─────────────────────────────────────────────────────────────
export const ProjectTimelineTab = ({
  project,
  projectEntities,
  projectSnapshots,
  schemaMap,
  entityTypeColorMap,
  schemas,
  lifecycleStates,
  teams,
  milestonesById,
  canEdit,
  onApplySnapshot,
  onEditSnapshot,
  onDeleteSnapshot
}: {
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  projectSnapshots: EntitySnapshot[];
  schemaMap: Map<string, SchemaInfo>;
  entityTypeColorMap: Map<string, string>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  milestonesById: Map<string, Milestone>;
  canEdit: boolean;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
  onEditSnapshot: (snapshot: EntitySnapshot) => void;
  onDeleteSnapshot: (snapshot: EntitySnapshot) => void;
}) => {
  const [zoom, setZoom] = useState<TimelineZoom>('quarter');
  const [groupByRole, setGroupByRole] = useState(false);
  const [selectedSnap, setSelectedSnap] = useState<EntitySnapshot | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const TODAY = useMemo(() => new Date(), []);
  const plannedSnapshots = useMemo(
    () => projectSnapshots.filter(snapshot => snapshot.status === 'future_update'),
    [projectSnapshots]
  );
  const appliedSnapshots = useMemo(
    () => projectSnapshots.filter(snapshot => snapshot.status === 'applied'),
    [projectSnapshots]
  );

  // Only dated snapshots go on the timeline; undated shown below. A milestone-backed snapshot
  // has no target_date of its own — its effective date comes from the milestone it targets.
  const datedSnapshots = useMemo(
    () => projectSnapshots.filter(s => getSnapshotEffectiveDate(s, milestonesById)),
    [projectSnapshots, milestonesById]
  );
  const undatedSnapshots = useMemo(
    () => projectSnapshots.filter(s => !getSnapshotEffectiveDate(s, milestonesById)),
    [projectSnapshots, milestonesById]
  );

  // A change case's members all share one case_id — group dated snapshots by case_id and keep
  // only the groups spanning more than one distinct entity. Those render as a single banded
  // marker instead of one row per member entity.
  const multiEntityCaseGroups = useMemo(() => {
    const groups = new Map<string, EntitySnapshot[]>();
    for (const s of datedSnapshots) {
      if (!s.case_id) continue;
      const list = groups.get(s.case_id);
      if (list) list.push(s);
      else groups.set(s.case_id, [s]);
    }
    for (const [caseId, group] of groups) {
      if (new Set(group.map(s => s.entity_id)).size <= 1) groups.delete(caseId);
    }
    return groups;
  }, [datedSnapshots]);

  const multiEntitySnapshotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of multiEntityCaseGroups.values()) {
      for (const s of group) ids.add(s.id);
    }
    return ids;
  }, [multiEntityCaseGroups]);

  const soloDatedSnapshots = useMemo(
    () => datedSnapshots.filter(s => !multiEntitySnapshotIds.has(s.id)),
    [datedSnapshots, multiEntitySnapshotIds]
  );

  // Snapshots per entity (solo — excludes members of banded multi-entity cases)
  const snapsByEntity = useMemo(() => {
    const m = new Map<string, EntitySnapshot[]>();
    for (const s of projectSnapshots) {
      if (multiEntitySnapshotIds.has(s.id)) continue;
      const list = m.get(s.entity_id);
      if (list) list.push(s);
      else m.set(s.entity_id, [s]);
    }
    return m;
  }, [projectSnapshots, multiEntitySnapshotIds]);

  // Entities that appear on the timeline (have at least one solo dated snapshot)
  const datedEntityIds = useMemo(
    () => new Set(soloDatedSnapshots.map(s => s.entity_id)),
    [soloDatedSnapshots]
  );

  // Entities on the timeline, preserving project order for the ungrouped view.
  const timelineEntities = useMemo(
    () => projectEntities.filter(entity => datedEntityIds.has(entity.entity_id)),
    [projectEntities, datedEntityIds]
  );

  // Group entities by entity_type, only those with dated snapshots
  const entityGroups = useMemo(() => {
    const groups = new Map<string, ProjectEntity[]>();
    for (const pe of timelineEntities) {
      const key = pe.entity_type?.id ?? '__none__';
      const list = groups.get(key);
      if (list) list.push(pe);
      else groups.set(key, [pe]);
    }
    return groups;
  }, [timelineEntities]);

  // Entity map for undated section
  const entityMap = useMemo(
    () => new Map(projectEntities.map(e => [e.entity_id, e])),
    [projectEntities]
  );

  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    for (const s of datedSnapshots) {
      const effectiveDate = getSnapshotEffectiveDate(s, milestonesById);
      if (effectiveDate) dates.push(new Date(`${effectiveDate}T00:00:00`));
    }
    return dates;
  }, [datedSnapshots, milestonesById]);

  const timeline = useSnapshotTimeline({
    dates: timelineDates,
    zoom,
    columnWidths: COL_W,
    milestones: milestonesById,
    today: TODAY
  });

  const handleSelect = (snap: EntitySnapshot | null) => {
    setSelectedCaseId(null);
    setSelectedSnap(prev => (snap?.id === prev?.id ? null : snap));
  };

  const handleSelectCase = (caseId: string | null) => {
    setSelectedSnap(null);
    setSelectedCaseId(prev => (caseId === prev ? null : caseId));
  };

  const totalEntities = projectEntities.length;
  const markerColor = project.color ?? 'var(--accent-fg)';

  const renderCaseBandRow = (caseId: string, group: EntitySnapshot[]) => {
    const first = group[0]!;
    const isRowActive = selectedCaseId === caseId;
    const effectiveDate = getSnapshotEffectiveDate(first, milestonesById);
    const px = stringDateToTimelinePx(
      effectiveDate,
      timeline.rangeStart,
      timeline.rangeEnd,
      timeline.totalWidth
    );
    const snapColor = first.status === 'applied' ? 'var(--green)' : markerColor;
    const dateLabel = getSnapshotDateLabel(first, milestonesById);
    const label = first.commit_message
      ? `${group.length} entities · ${first.commit_message}`
      : `${group.length} entities`;

    return (
      <div
        key={caseId}
        className={`${styles.ptlRow} ${isRowActive ? styles.ptlRowActive : ''}`}
      >
        <div className={styles.ptlLabel}>
          <span className={styles.ptlName}>{label}</span>
        </div>
        <div className={styles.ptlTrack} style={{ width: timeline.totalWidth }}>
          {px !== null && (
            <div
              className={`${styles.ptlMarker} ${isRowActive ? styles.ptlMarkerSelected : ''}`}
              style={{ left: px }}
              onClick={() => handleSelectCase(caseId)}
              title={dateLabel ? `${label} (${dateLabel})` : label}
            >
              <span
                className={first.status === 'applied' ? styles.ptlMarkerDot : styles.ptlMarkerDiamond}
                style={{ background: snapColor }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEntityRow = (entity: ProjectEntity) => {
    const schema = entity.entity_schema ? schemaMap.get(entity.entity_schema.id) : undefined;
    const entitySnaps = snapsByEntity.get(entity.entity_id) ?? [];
    const datedEntitySnaps = entitySnaps.filter(s => getSnapshotEffectiveDate(s, milestonesById));
    const isRowActive = datedEntitySnaps.some(s => s.id === selectedSnap?.id);

    return (
      <div
        key={entity.entity_id}
        className={`${styles.ptlRow} ${isRowActive ? styles.ptlRowActive : ''}`}
      >
        <div className={styles.ptlLabel}>
          {schema && <TypeBadge color={schema.color} icon={schema.icon} size={14} />}
          <span className={styles.ptlName}>{entity.entity_name}</span>
        </div>
        <div className={styles.ptlTrack} style={{ width: timeline.totalWidth }}>
          {datedEntitySnaps.map(snap => {
            const effectiveDate = getSnapshotEffectiveDate(snap, milestonesById);
            const px = stringDateToTimelinePx(
              effectiveDate,
              timeline.rangeStart,
              timeline.rangeEnd,
              timeline.totalWidth
            );
            if (px === null) return null;
            const isSelected = selectedSnap?.id === snap.id;
            const snapColor = snap.status === 'applied' ? 'var(--green)' : markerColor;
            const dateLabel = getSnapshotDateLabel(snap, milestonesById);
            return (
              <div
                key={snap.id}
                className={`${styles.ptlMarker} ${isSelected ? styles.ptlMarkerSelected : ''}`}
                style={{ left: px }}
                onClick={() => handleSelect(isSelected ? null : snap)}
                title={
                  snap.commit_message
                    ? `${snap.commit_message} (${dateLabel})`
                    : (dateLabel ?? snap.status)
                }
              >
                <span
                  className={
                    snap.status === 'applied' ? styles.ptlMarkerDot : styles.ptlMarkerDiamond
                  }
                  style={{ background: snapColor }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (projectSnapshots.length === 0) {
    return (
      <div className={styles.ptEmpty}>
        <div className={styles.ptEmptyTitle}>No project updates yet</div>
        <div className={styles.ptEmptySub}>
          Use the entity menu to plan future changes for entities in this project.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ptl}>
      {/* Config bar */}
      <div className={styles.ptlConfig}>
        <div className={styles.ptlLegend}>
          <span className={styles.ptlLegItem}>
            <span className={styles.ptlLegDiamond} style={{ background: markerColor }} />
            Planned change
          </span>
          <span className={styles.ptlLegItem}>
            <span className={styles.ptlLegDot} style={{ background: 'var(--green)' }} />
            Applied update
          </span>
        </div>
        <div className={styles.ptlSep} />
        <span className={styles.ptlConfigMeta}>
          {totalEntities} entities · {plannedSnapshots.length} planned · {appliedSnapshots.length}{' '}
          applied
        </span>
        <div style={{ flex: 1 }} />
        <div className={styles.ptlGrouping} role="toolbar" aria-label="Timeline grouping">
          <div className={styles.ptlSegmented}>
            <button
              type="button"
              className={groupByRole ? styles.ptlSegActive : undefined}
              aria-pressed={groupByRole}
              onClick={() => setGroupByRole(true)}
            >
              Role
            </button>
            <button
              type="button"
              className={!groupByRole ? styles.ptlSegActive : undefined}
              aria-pressed={!groupByRole}
              onClick={() => setGroupByRole(false)}
            >
              Entities
            </button>
          </div>
        </div>
        <div className={styles.ptlSegmented}>
          {(['month', 'quarter', 'year'] as const).map((z, i) => (
            <button
              key={z}
              type="button"
              className={zoom === z ? styles.ptlSegActive : undefined}
              onClick={() => setZoom(z)}
            >
              {(['Mo', 'Qr', 'Yr'] as const)[i]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.ptlBody}>
        <SnapshotTimelineShell
          context={timeline}
          scrollClassName={styles.ptlScroll}
          innerClassName={styles.ptlInner}
          labelWidth={LABEL_W}
          classes={{
            head: styles.ptlHead,
            corner: styles.ptlCorner,
            cornerLabel: styles.ptlCornerLabel,
            columns: styles.ptlCols,
            column: styles.ptlCol,
            currentColumn: styles.ptlColNow,
            today: styles.ptlToday,
            todayPip: styles.ptlTodayPip,
            milestoneLine: styles.ptlMilestoneLine,
            milestoneLabel: styles.ptlMilestoneLabel
          }}
          cornerLabel={`${totalEntities} entities`}
          showHeader={datedSnapshots.length > 0}
          showToday={datedSnapshots.length > 0}
          showMilestones={datedSnapshots.length > 0}
          milestoneAriaLabel={milestone =>
            `Milestone: ${milestone.name} (${milestone.target_date})`
          }
          todayScrollAlign={0.4}
        >
          {timeline.milestoneMarkers.length > 0 && datedSnapshots.length > 0 && (
            <div className={styles.ptlMilestoneLane}>
              <div className={styles.ptlMilestoneLaneCorner}>Milestones</div>
              <div
                className={styles.ptlMilestoneLaneTrack}
                style={{ width: timeline.totalWidth }}
              />
            </div>
          )}

          {multiEntityCaseGroups.size > 0 && (
            <div>
              <div className={styles.ptlGrpRow}>
                <div className={styles.ptlGrpLabel}>
                  <span>Multi-entity changes</span>
                  <span className={styles.ptlGrpCount}>({multiEntityCaseGroups.size})</span>
                </div>
              </div>
              {[...multiEntityCaseGroups.entries()].map(([caseId, group]) =>
                renderCaseBandRow(caseId, group)
              )}
            </div>
          )}

          {datedSnapshots.length > 0 &&
            (groupByRole
              ? [...entityGroups.entries()].map(([typeId, entities]) => {
                  const roleName = entities[0]?.entity_type?.name;
                  const roleColor =
                    typeId !== '__none__' ? entityTypeColorMap.get(typeId) : undefined;
                  return (
                    <div key={typeId}>
                      <div className={styles.ptlGrpRow}>
                        <div className={styles.ptlGrpLabel}>
                          {roleColor && (
                            <span className={styles.ptlGrpDot} style={{ background: roleColor }} />
                          )}
                          <span>{roleName ?? 'Other'}</span>
                          <span className={styles.ptlGrpCount}>({entities.length})</span>
                        </div>
                      </div>
                      {entities.map(renderEntityRow)}
                    </div>
                  );
                })
              : timelineEntities.map(renderEntityRow))}

          {undatedSnapshots.length > 0 && (
            <div className={styles.ptlUndated}>
              <div className={styles.ptlUndatedLabel}>No target date</div>
              {undatedSnapshots.map(snap => {
                const pe = entityMap.get(snap.entity_id);
                const schema = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
                return (
                  <div key={snap.id} className={styles.ptlUndatedRow}>
                    {schema && <TypeBadge color={schema.color} icon={schema.icon} size={14} />}
                    <span className={styles.ptlName}>{pe?.entity_name ?? snap.entity_id}</span>
                    {snap.commit_message && (
                      <span className={styles.ptlUndatedNote}>{snap.commit_message}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SnapshotTimelineShell>

        {/* Detail panel */}
        {selectedSnap &&
          (() => {
            const pe = entityMap.get(selectedSnap.entity_id);
            const schemaInfo = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
            // Find the full EntitySchema for field resolution (use proposed_state.schema_id or entity schema id)
            const schemaId =
              ((selectedSnap.proposed_state as Record<string, unknown> | null)?.['schema_id'] as
                | string
                | undefined) ?? pe?.entity_schema?.id;
            const entitySchema = schemaId ? (schemas.find(s => s.id === schemaId) ?? null) : null;
            return (
              <SnapDetail
                snapshot={selectedSnap}
                entityName={pe?.entity_name ?? selectedSnap.entity_id}
                schemaInfo={schemaInfo}
                entitySchema={entitySchema}
                markerColor={selectedSnap.status === 'applied' ? 'var(--green)' : markerColor}
                milestonesById={milestonesById}
                lifecycleStates={lifecycleStates}
                teams={teams}
                canEdit={canEdit}
                onApplySnapshot={onApplySnapshot}
                onEditSnapshot={onEditSnapshot}
                onDeleteSnapshot={onDeleteSnapshot}
                onClose={() => setSelectedSnap(null)}
              />
            );
          })()}

        {selectedCaseId &&
          (() => {
            const group = multiEntityCaseGroups.get(selectedCaseId);
            if (!group) return null;
            const first = group[0]!;
            return (
              <CaseBandDetail
                group={group}
                entityMap={entityMap}
                schemaMap={schemaMap}
                schemas={schemas}
                lifecycleStates={lifecycleStates}
                teams={teams}
                markerColor={first.status === 'applied' ? 'var(--green)' : markerColor}
                canEdit={canEdit}
                onApplySnapshot={onApplySnapshot}
                onEditSnapshot={onEditSnapshot}
                onDeleteSnapshot={onDeleteSnapshot}
                onClose={() => setSelectedCaseId(null)}
              />
            );
          })()}
      </div>
    </div>
  );
};

// ── Multi-entity case band detail panel ────────────────────────────────────────
const CaseBandDetail = ({
  group,
  entityMap,
  schemaMap,
  schemas,
  lifecycleStates,
  teams,
  markerColor,
  canEdit,
  onApplySnapshot,
  onEditSnapshot,
  onDeleteSnapshot,
  onClose
}: {
  group: EntitySnapshot[];
  entityMap: Map<string, ProjectEntity>;
  schemaMap: Map<string, SchemaInfo>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  markerColor: string;
  canEdit: boolean;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
  onEditSnapshot: (snapshot: EntitySnapshot) => void;
  onDeleteSnapshot: (snapshot: EntitySnapshot) => void;
  onClose: () => void;
}) => {
  const first = group[0]!;
  const statusLabel = first.status === 'applied' ? 'Applied' : 'Planned';
  const canManage = canEdit && first.status === 'future_update';

  return (
    <div className={styles.ptlDetail}>
      <div className={styles.ptlDetailHead}>
        <div className={styles.ptlDetailEntity}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.ptlDetailName}>{group.length} entities</div>
          </div>
        </div>
        <button type="button" className={styles.ptlDetailCloseBtn} onClick={onClose}>
          <TbX size={12} />
        </button>
      </div>

      <div className={styles.ptlDetailBody}>
        <div className={styles.ptlDetailStatusRow}>
          <span
            className={styles.ptlDetailBadge}
            style={{ color: markerColor, borderColor: markerColor }}
          >
            {statusLabel}
          </span>
        </div>

        {first.commit_message && <div className={styles.ptlDetailMsg}>"{first.commit_message}"</div>}

        <div className={styles.ptlDetailChanges}>
          <div className={styles.ptlDetailSectionLabel}>Entities</div>
          {group.map(snap => {
            const pe = entityMap.get(snap.entity_id);
            const schemaInfo = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
            const schemaId =
              ((snap.proposed_state as Record<string, unknown> | null)?.['schema_id'] as
                | string
                | undefined) ?? pe?.entity_schema?.id;
            const entitySchema = schemaId ? (schemas.find(s => s.id === schemaId) ?? null) : null;
            const changes = diffSnapshotState(
              snap.base_state as Record<string, unknown> | undefined,
              snap.proposed_state as Record<string, unknown> | undefined,
              entitySchema,
              lifecycleStates,
              teams
            );
            return (
              <div key={snap.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {schemaInfo && (
                    <TypeBadge color={schemaInfo.color} icon={schemaInfo.icon} size={14} />
                  )}
                  <span className={styles.ptlName}>{pe?.entity_name ?? snap.entity_id}</span>
                </div>
                {changes.map(change => (
                  <div key={change.label} className={styles.ptlChgRow}>
                    <span className={styles.ptlChgField}>{change.label}</span>
                    <span className={styles.ptlChgFrom}>{change.from}</span>
                    <span className={styles.ptlChgArrow}>→</span>
                    <span className={styles.ptlChgTo}>{change.to}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {canManage && (
          <div className={styles.ptlDetailActions}>
            <Button onClick={() => onApplySnapshot(first)}>Apply</Button>
            <Button icon={<TbPencil size={12} />} onClick={() => onEditSnapshot(first)}>
              Edit
            </Button>
            <Button
              variant="danger"
              icon={<TbTrash size={12} />}
              onClick={() => onDeleteSnapshot(first)}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Detail panel ───────────────────────────────────────────────────────────────
const SnapDetail = ({
  snapshot,
  entityName,
  schemaInfo,
  entitySchema,
  markerColor,
  milestonesById,
  lifecycleStates,
  teams,
  canEdit,
  onApplySnapshot,
  onEditSnapshot,
  onDeleteSnapshot,
  onClose
}: {
  snapshot: EntitySnapshot;
  entityName: string;
  schemaInfo: SchemaInfo | undefined;
  entitySchema: EntitySchema | null;
  markerColor: string;
  milestonesById: Map<string, Milestone>;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canEdit: boolean;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
  onEditSnapshot: (snapshot: EntitySnapshot) => void;
  onDeleteSnapshot: (snapshot: EntitySnapshot) => void;
  onClose: () => void;
}) => {
  const statusLabel = snapshot.status === 'applied' ? 'Applied' : 'Planned';
  const canManage = canEdit && snapshot.status === 'future_update';

  const changes = diffSnapshotState(
    snapshot.base_state as Record<string, unknown> | undefined,
    snapshot.proposed_state as Record<string, unknown> | undefined,
    entitySchema,
    lifecycleStates,
    teams
  );

  return (
    <div className={styles.ptlDetail}>
      <div className={styles.ptlDetailHead}>
        <div className={styles.ptlDetailEntity}>
          {schemaInfo && <TypeBadge color={schemaInfo.color} icon={schemaInfo.icon} size={18} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.ptlDetailName}>{entityName}</div>
          </div>
        </div>
        <button type="button" className={styles.ptlDetailCloseBtn} onClick={onClose}>
          <TbX size={12} />
        </button>
      </div>

      <div className={styles.ptlDetailBody}>
        <div className={styles.ptlDetailStatusRow}>
          <span
            className={styles.ptlDetailBadge}
            style={{ color: markerColor, borderColor: markerColor }}
          >
            {statusLabel}
          </span>
          {getSnapshotDateLabel(snapshot, milestonesById) && (
            <span className={styles.ptlDetailSub}>
              {snapshot.milestone_id ? 'Milestone' : 'Target'}:{' '}
              {getSnapshotDateLabel(snapshot, milestonesById)}
            </span>
          )}
        </div>

        {snapshot.commit_message && (
          <div className={styles.ptlDetailMsg}>"{snapshot.commit_message}"</div>
        )}

        {changes.length > 0 && (
          <div className={styles.ptlDetailChanges}>
            <div className={styles.ptlDetailSectionLabel}>Changes</div>
            {changes.map(change => (
              <div key={change.label} className={styles.ptlChgRow}>
                <span className={styles.ptlChgField}>{change.label}</span>
                <span className={styles.ptlChgFrom}>{change.from}</span>
                <span className={styles.ptlChgArrow}>→</span>
                <span className={styles.ptlChgTo}>{change.to}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.ptlDetailMeta}>
          <span>
            {formatTimelineDate(snapshot.created_at, { month: 'short', year: 'numeric' })}
          </span>
        </div>

        {canManage && (
          <div className={styles.ptlDetailActions}>
            <Button onClick={() => onApplySnapshot(snapshot)}>Apply</Button>
            <Button icon={<TbPencil size={12} />} onClick={() => onEditSnapshot(snapshot)}>
              Edit
            </Button>
            <Button
              variant="danger"
              icon={<TbTrash size={12} />}
              onClick={() => onDeleteSnapshot(snapshot)}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
