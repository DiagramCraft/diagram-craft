import { useState, useMemo } from 'react';
import { TbChevronDown, TbChevronRight, TbPencil, TbTrash, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  ProjectDetail as ProjectDetailData,
  ProjectEntity
} from '@arch-register/api-types/projectContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
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
  getSnapshotEffectiveDate,
  flattenChangeCaseMembers,
  type ChangeCaseMemberEntry
} from '../entities/components/snapshotDisplay';
import styles from './ProjectDetailScreen.module.css';

type SchemaInfo = { color: string; icon: string | null };

const LABEL_W = 248;
const COL_W: TimelineColumnWidths = { month: 72, quarter: 100, year: 136 };

// ── Main component ─────────────────────────────────────────────────────────────
export const ProjectTimelineTab = ({
  project,
  projectEntities,
  changeCases,
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
  changeCases: ChangeCase[];
  schemaMap: Map<string, SchemaInfo>;
  entityTypeColorMap: Map<string, string>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  milestonesById: Map<string, Milestone>;
  canEdit: boolean;
  onApplySnapshot: (entry: ChangeCaseMemberEntry) => void;
  onEditSnapshot: (entry: ChangeCaseMemberEntry) => void;
  onDeleteSnapshot: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const [zoom, setZoom] = useState<TimelineZoom>('quarter');
  const [groupByRole, setGroupByRole] = useState(false);
  const [selectedSnap, setSelectedSnap] = useState<ChangeCaseMemberEntry | null>(null);
  const TODAY = useMemo(() => new Date(), []);
  const projectEntries = useMemo(() => flattenChangeCaseMembers(changeCases), [changeCases]);
  const plannedSnapshots = useMemo(
    () => projectEntries.filter(entry => entry.changeCase.status === 'planned'),
    [projectEntries]
  );
  const appliedSnapshots = useMemo(
    () => projectEntries.filter(entry => entry.changeCase.status === 'applied'),
    [projectEntries]
  );

  // Only dated entries go on the timeline; undated shown below. A milestone-backed entry has no
  // target_date of its own — its effective date comes from the milestone it targets.
  const datedSnapshots = useMemo(
    () =>
      projectEntries.filter(entry => getSnapshotEffectiveDate(entry.changeCase, milestonesById)),
    [projectEntries, milestonesById]
  );
  const undatedSnapshots = useMemo(
    () =>
      projectEntries.filter(entry => !getSnapshotEffectiveDate(entry.changeCase, milestonesById)),
    [projectEntries, milestonesById]
  );

  // Entries per entity — every entity change gets its own row and marker; change cases are
  // never collapsed into a single lane here (see the Future Changes tab for case-level grouping).
  const snapsByEntity = useMemo(() => {
    const m = new Map<string, ChangeCaseMemberEntry[]>();
    for (const entry of projectEntries) {
      const list = m.get(entry.member.entity_id);
      if (list) list.push(entry);
      else m.set(entry.member.entity_id, [entry]);
    }
    return m;
  }, [projectEntries]);

  // Entities that appear on the timeline (have at least one dated entry)
  const datedEntityIds = useMemo(
    () => new Set(datedSnapshots.map(entry => entry.member.entity_id)),
    [datedSnapshots]
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
    for (const entry of datedSnapshots) {
      const effectiveDate = getSnapshotEffectiveDate(entry.changeCase, milestonesById);
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

  const handleSelect = (entry: ChangeCaseMemberEntry | null) => {
    setSelectedSnap(prev => (entry?.member.id === prev?.member.id ? null : entry));
  };

  const totalEntities = projectEntities.length;
  const markerColor = project.color ?? 'var(--accent-fg)';

  const renderEntityRow = (entity: ProjectEntity) => {
    const schema = entity.entity_schema ? schemaMap.get(entity.entity_schema.id) : undefined;
    const entitySnaps = snapsByEntity.get(entity.entity_id) ?? [];
    const datedEntitySnaps = entitySnaps.filter(entry =>
      getSnapshotEffectiveDate(entry.changeCase, milestonesById)
    );
    const isRowActive = datedEntitySnaps.some(entry => entry.member.id === selectedSnap?.member.id);

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
          {datedEntitySnaps.map(entry => {
            const effectiveDate = getSnapshotEffectiveDate(entry.changeCase, milestonesById);
            const px = stringDateToTimelinePx(
              effectiveDate,
              timeline.rangeStart,
              timeline.rangeEnd,
              timeline.totalWidth
            );
            if (px === null) return null;
            const isSelected = selectedSnap?.member.id === entry.member.id;
            const isApplied = entry.changeCase.status === 'applied';
            const snapColor = isApplied ? 'var(--green)' : markerColor;
            const dateLabel = getSnapshotDateLabel(entry.changeCase, milestonesById);
            const commitMessage = entry.changeCase.commit_message;
            return (
              <div
                key={entry.member.id}
                className={`${styles.ptlMarker} ${isSelected ? styles.ptlMarkerSelected : ''}`}
                style={{ left: px }}
                onClick={() => handleSelect(isSelected ? null : entry)}
                title={
                  commitMessage
                    ? `${commitMessage} (${dateLabel})`
                    : (dateLabel ?? entry.changeCase.status)
                }
              >
                <span
                  className={isApplied ? styles.ptlMarkerDot : styles.ptlMarkerDiamond}
                  style={{ background: snapColor }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (projectEntries.length === 0) {
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
              {undatedSnapshots.map(entry => {
                const pe = entityMap.get(entry.member.entity_id);
                const schema = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
                return (
                  <div key={entry.member.id} className={styles.ptlUndatedRow}>
                    {schema && <TypeBadge color={schema.color} icon={schema.icon} size={14} />}
                    <span className={styles.ptlName}>
                      {pe?.entity_name ?? entry.member.entity_id}
                    </span>
                    {entry.changeCase.commit_message && (
                      <span className={styles.ptlUndatedNote}>
                        {entry.changeCase.commit_message}
                      </span>
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
            const pe = entityMap.get(selectedSnap.member.entity_id);
            const schemaInfo = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
            // Find the full EntitySchema for field resolution (use proposed_state.schema_id or entity schema id)
            const schemaId =
              ((selectedSnap.member.proposed_state as Record<string, unknown> | null)?.[
                'schema_id'
              ] as string | undefined) ?? pe?.entity_schema?.id;
            const entitySchema = schemaId ? (schemas.find(s => s.id === schemaId) ?? null) : null;
            const siblingSnapshots = projectEntries.filter(
              entry =>
                entry.changeCase.id === selectedSnap.changeCase.id &&
                entry.member.entity_id !== selectedSnap.member.entity_id
            );
            return (
              <SnapDetail
                entry={selectedSnap}
                entityName={pe?.entity_name ?? selectedSnap.member.entity_id}
                schemaInfo={schemaInfo}
                entitySchema={entitySchema}
                markerColor={
                  selectedSnap.changeCase.status === 'applied' ? 'var(--green)' : markerColor
                }
                milestonesById={milestonesById}
                lifecycleStates={lifecycleStates}
                teams={teams}
                canEdit={canEdit}
                siblingSnapshots={siblingSnapshots}
                entityMap={entityMap}
                schemaMap={schemaMap}
                schemas={schemas}
                onApplySnapshot={onApplySnapshot}
                onEditSnapshot={onEditSnapshot}
                onDeleteSnapshot={onDeleteSnapshot}
                onClose={() => setSelectedSnap(null)}
              />
            );
          })()}
      </div>
    </div>
  );
};

// ── Detail panel ───────────────────────────────────────────────────────────────
const SnapDetail = ({
  entry,
  entityName,
  schemaInfo,
  entitySchema,
  markerColor,
  milestonesById,
  lifecycleStates,
  teams,
  canEdit,
  siblingSnapshots,
  entityMap,
  schemaMap,
  schemas,
  onApplySnapshot,
  onEditSnapshot,
  onDeleteSnapshot,
  onClose
}: {
  entry: ChangeCaseMemberEntry;
  entityName: string;
  schemaInfo: SchemaInfo | undefined;
  entitySchema: EntitySchema | null;
  markerColor: string;
  milestonesById: Map<string, Milestone>;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canEdit: boolean;
  siblingSnapshots: ChangeCaseMemberEntry[];
  entityMap: Map<string, ProjectEntity>;
  schemaMap: Map<string, SchemaInfo>;
  schemas: EntitySchema[];
  onApplySnapshot: (entry: ChangeCaseMemberEntry) => void;
  onEditSnapshot: (entry: ChangeCaseMemberEntry) => void;
  onDeleteSnapshot: (entry: ChangeCaseMemberEntry) => void;
  onClose: () => void;
}) => {
  const [siblingsExpanded, setSiblingsExpanded] = useState(false);
  const { changeCase, member } = entry;
  const statusLabel = changeCase.status === 'applied' ? 'Applied' : 'Planned';
  const canManage = canEdit && changeCase.status === 'planned';

  const changes = diffSnapshotState(
    member.base_state as Record<string, unknown> | undefined,
    member.proposed_state as Record<string, unknown> | undefined,
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
        {changeCase?.name && (
          <div className={styles.ptlDetailCaseHead}>
            <div className={styles.ptlDetailCaseName}>{changeCase.name}</div>
          </div>
        )}

        <div className={styles.ptlDetailStatusRow}>
          <span
            className={styles.ptlDetailBadge}
            style={{ color: markerColor, borderColor: markerColor }}
          >
            {statusLabel}
          </span>
          {getSnapshotDateLabel(changeCase, milestonesById) && (
            <span className={styles.ptlDetailSub}>
              {changeCase.milestone_id ? 'Milestone' : 'Target'}:{' '}
              {getSnapshotDateLabel(changeCase, milestonesById)}
            </span>
          )}
        </div>

        {changeCase.commit_message && (
          <div className={styles.ptlDetailMsg}>"{changeCase.commit_message}"</div>
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
            {formatTimelineDate(changeCase.created_at, { month: 'short', year: 'numeric' })}
          </span>
        </div>

        {siblingSnapshots.length > 0 && (
          <div className={styles.ptlDetailSiblings}>
            <button
              type="button"
              className={styles.ptlDetailSiblingsToggle}
              onClick={() => setSiblingsExpanded(v => !v)}
            >
              {siblingsExpanded ? <TbChevronDown size={13} /> : <TbChevronRight size={13} />}
              <span>
                Also changes {siblingSnapshots.length} other{' '}
                {siblingSnapshots.length === 1 ? 'entity' : 'entities'}
              </span>
            </button>
            {siblingsExpanded && (
              <div className={styles.ptlDetailSiblingsBody}>
                {siblingSnapshots.map(sibling => {
                  const pe = entityMap.get(sibling.member.entity_id);
                  const siblingSchemaInfo = pe?.entity_schema
                    ? schemaMap.get(pe.entity_schema.id)
                    : undefined;
                  const siblingSchemaId =
                    ((sibling.member.proposed_state as Record<string, unknown> | null)?.[
                      'schema_id'
                    ] as string | undefined) ?? pe?.entity_schema?.id;
                  const siblingSchema = siblingSchemaId
                    ? (schemas.find(s => s.id === siblingSchemaId) ?? null)
                    : null;
                  const siblingChanges = diffSnapshotState(
                    sibling.member.base_state as Record<string, unknown> | undefined,
                    sibling.member.proposed_state as Record<string, unknown> | undefined,
                    siblingSchema,
                    lifecycleStates,
                    teams
                  );
                  return (
                    <div key={sibling.member.id} className={styles.ptlDetailSiblingItem}>
                      <div className={styles.ptlDetailSiblingHead}>
                        {siblingSchemaInfo && (
                          <TypeBadge
                            color={siblingSchemaInfo.color}
                            icon={siblingSchemaInfo.icon}
                            size={14}
                          />
                        )}
                        <span className={styles.ptlName}>
                          {pe?.entity_name ?? sibling.member.entity_id}
                        </span>
                      </div>
                      {siblingChanges.length > 0 ? (
                        siblingChanges.map(change => (
                          <div key={change.label} className={styles.ptlChgRow}>
                            <span className={styles.ptlChgField}>{change.label}</span>
                            <span className={styles.ptlChgFrom}>{change.from}</span>
                            <span className={styles.ptlChgArrow}>→</span>
                            <span className={styles.ptlChgTo}>{change.to}</span>
                          </div>
                        ))
                      ) : (
                        <span className={styles.ptlDetailSiblingNoChanges}>No field changes</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {canManage && (
          <div className={styles.ptlDetailActions}>
            <Button onClick={() => onApplySnapshot(entry)}>Apply</Button>
            <Button icon={<TbPencil size={12} />} onClick={() => onEditSnapshot(entry)}>
              Edit
            </Button>
            <Button
              variant="danger"
              icon={<TbTrash size={12} />}
              onClick={() => onDeleteSnapshot(entry)}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
