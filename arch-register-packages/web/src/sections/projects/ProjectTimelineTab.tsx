import { useState, useMemo } from 'react';
import { TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { ProjectDetail as ProjectDetailData, ProjectEntity } from '@arch-register/api-types/projectContract';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { TimelineScaffold } from '../../components/timeline/TimelineScaffold';
import {
  buildTimelineRange,
  formatTimelineDate,
  getTodayTimelinePx,
  stringDateToTimelinePx,
  type TimelineColumnWidths,
  type TimelineZoom
} from '../../components/timeline/timelineUtils';
import { TypeBadge } from '../../components/TypeBadge';
import { diffSnapshotState } from '../entities/components/entityTimelineHelpers';
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
  canEdit,
  onApplySnapshot
}: {
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  projectSnapshots: EntitySnapshot[];
  schemaMap: Map<string, SchemaInfo>;
  entityTypeColorMap: Map<string, string>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canEdit: boolean;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
}) => {
  const [zoom, setZoom] = useState<TimelineZoom>('quarter');
  const [selectedSnap, setSelectedSnap] = useState<EntitySnapshot | null>(null);
  const TODAY = useMemo(() => new Date(), []);
  const plannedSnapshots = useMemo(
    () => projectSnapshots.filter(snapshot => snapshot.status === 'future_update'),
    [projectSnapshots]
  );
  const appliedSnapshots = useMemo(
    () => projectSnapshots.filter(snapshot => snapshot.status === 'applied'),
    [projectSnapshots]
  );

  // Only dated snapshots go on the timeline; undated shown below
  const datedSnapshots = useMemo(() => projectSnapshots.filter(s => s.target_date), [projectSnapshots]);
  const undatedSnapshots = useMemo(() => projectSnapshots.filter(s => !s.target_date), [projectSnapshots]);

  // Snapshots per entity
  const snapsByEntity = useMemo(() => {
    const m = new Map<string, EntitySnapshot[]>();
    for (const s of projectSnapshots) {
      const list = m.get(s.entity_id);
      if (list) list.push(s);
      else m.set(s.entity_id, [s]);
    }
    return m;
  }, [projectSnapshots]);

  // Entities that appear on the timeline (have at least one dated snapshot)
  const datedEntityIds = useMemo(
    () => new Set(datedSnapshots.map(s => s.entity_id)),
    [datedSnapshots]
  );

  // Group entities by entity_type, only those with dated snapshots
  const entityGroups = useMemo(() => {
    const groups = new Map<string, ProjectEntity[]>();
    for (const pe of projectEntities) {
      if (!datedEntityIds.has(pe.entity_id)) continue;
      const key = pe.entity_type?.id ?? '__none__';
      const list = groups.get(key);
      if (list) list.push(pe);
      else groups.set(key, [pe]);
    }
    return groups;
  }, [projectEntities, datedEntityIds]);

  // Entity map for undated section
  const entityMap = useMemo(
    () => new Map(projectEntities.map(e => [e.entity_id, e])),
    [projectEntities]
  );

  const { rangeStart, rangeEnd, columns, totalWidth } = useMemo(() => {
    const dates: Date[] = [];
    for (const s of datedSnapshots) {
      if (s.target_date) dates.push(new Date(`${s.target_date}T00:00:00`));
    }
    return buildTimelineRange({
      dates,
      zoom,
      columnWidths: COL_W,
      today: TODAY
    });
  }, [datedSnapshots, zoom, TODAY]);

  const todayPx = useMemo(
    () => getTodayTimelinePx(TODAY, rangeStart, rangeEnd, totalWidth),
    [TODAY, rangeStart, rangeEnd, totalWidth]
  );

  const handleSelect = (snap: EntitySnapshot | null) => {
    setSelectedSnap(prev => (snap?.id === prev?.id ? null : snap));
  };

  const totalEntities = projectEntities.length;
  const markerColor = project.color ?? 'var(--accent-fg)';

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
          {totalEntities} entities · {plannedSnapshots.length} planned · {appliedSnapshots.length} applied
        </span>
        <div style={{ flex: 1 }} />
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
        <TimelineScaffold
          scrollClassName={styles.ptlScroll}
          innerClassName={styles.ptlInner}
          labelWidth={LABEL_W}
          totalWidth={totalWidth}
          todayPx={todayPx}
          todayScrollAlign={0.4}
          header={
            datedSnapshots.length > 0 ? (
              <div className={styles.ptlHead}>
                <div className={styles.ptlCorner}>
                  <span className={styles.ptlCornerLabel}>{totalEntities} entities</span>
                </div>
                <div className={styles.ptlCols} style={{ width: totalWidth }}>
                  {columns.map((col, i) => (
                    <div
                      key={i}
                      className={`${styles.ptlCol} ${col.isCurrent ? styles.ptlColNow : ''}`}
                      style={{ width: col.width }}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          }
          todayLine={
            todayPx === null || datedSnapshots.length === 0 ? null : (
              <div className={styles.ptlToday} style={{ left: LABEL_W + todayPx }}>
                <span className={styles.ptlTodayPip}>▾</span>
              </div>
            )
          }
        >
          {datedSnapshots.length > 0 &&
            [...entityGroups.entries()].map(([typeId, entities]) => {
              const roleName = entities[0]?.entity_type?.name;
              const roleColor = typeId !== '__none__' ? entityTypeColorMap.get(typeId) : undefined;
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

                  {entities.map(entity => {
                    const schema = entity.entity_schema
                      ? schemaMap.get(entity.entity_schema.id)
                      : undefined;
                    const entitySnaps = snapsByEntity.get(entity.entity_id) ?? [];
                    const datedEntitySnaps = entitySnaps.filter(s => s.target_date);
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
                        <div className={styles.ptlTrack} style={{ width: totalWidth }}>
                          {datedEntitySnaps.map(snap => {
                            const px = stringDateToTimelinePx(
                              snap.target_date,
                              rangeStart,
                              rangeEnd,
                              totalWidth
                            );
                            if (px === null) return null;
                            const isSelected = selectedSnap?.id === snap.id;
                            const snapColor =
                              snap.status === 'applied' ? 'var(--green)' : markerColor;
                            return (
                              <div
                                key={snap.id}
                                className={`${styles.ptlMarker} ${isSelected ? styles.ptlMarkerSelected : ''}`}
                                style={{ left: px }}
                                onClick={() => handleSelect(isSelected ? null : snap)}
                                title={snap.commit_message ?? snap.status}
                              >
                                <span
                                  className={
                                    snap.status === 'applied'
                                      ? styles.ptlMarkerDot
                                      : styles.ptlMarkerDiamond
                                  }
                                  style={{ background: snapColor }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

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
        </TimelineScaffold>

        {/* Detail panel */}
        {selectedSnap && (() => {
          const pe = entityMap.get(selectedSnap.entity_id);
          const schemaInfo = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
          // Find the full EntitySchema for field resolution (use proposed_state.schema_id or entity schema id)
          const schemaId = (selectedSnap.proposed_state as Record<string, unknown> | null)?.['schema_id'] as string | undefined
            ?? pe?.entity_schema?.id;
          const entitySchema = schemaId ? schemas.find(s => s.id === schemaId) ?? null : null;
          return (
            <SnapDetail
              snapshot={selectedSnap}
              entityName={pe?.entity_name ?? selectedSnap.entity_id}
              schemaInfo={schemaInfo}
              entitySchema={entitySchema}
              markerColor={selectedSnap.status === 'applied' ? 'var(--green)' : markerColor}
              lifecycleStates={lifecycleStates}
              teams={teams}
              canEdit={canEdit}
              onApplySnapshot={onApplySnapshot}
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
  snapshot,
  entityName,
  schemaInfo,
  entitySchema,
  markerColor,
  lifecycleStates,
  teams,
  canEdit,
  onApplySnapshot,
  onClose
}: {
  snapshot: EntitySnapshot;
  entityName: string;
  schemaInfo: SchemaInfo | undefined;
  entitySchema: EntitySchema | null;
  markerColor: string;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canEdit: boolean;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
  onClose: () => void;
}) => {
  const statusLabel = snapshot.status === 'applied' ? 'Applied' : 'Planned';
  const canApply = canEdit && snapshot.status === 'future_update';

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
          {snapshot.target_date && (
            <span className={styles.ptlDetailSub}>
              Target: {snapshot.target_date}
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
          <span>{formatTimelineDate(snapshot.created_at, { month: 'short', year: 'numeric' })}</span>
        </div>

        {canApply && (
          <div className={styles.ptlDetailActions}>
            <Button onClick={() => onApplySnapshot(snapshot)}>Apply</Button>
          </div>
        )}
      </div>
    </div>
  );
};
