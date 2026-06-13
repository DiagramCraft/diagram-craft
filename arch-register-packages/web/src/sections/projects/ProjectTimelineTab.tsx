import { useState, useMemo, useRef, useEffect } from 'react';
import { TbX } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData, ProjectEntity } from '@arch-register/api-types/projectContract';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '../../lib/api';
import { TypeBadge } from '../../components/TypeBadge';
import { diffSnapshotState } from '../entities/EntityTimelineTab';
import styles from './ProjectDetailScreen.module.css';

type SchemaInfo = { color: string; icon: string | null };
type Zoom = 'month' | 'quarter' | 'year';

const LABEL_W = 248;
const COL_W: Record<Zoom, number> = { month: 72, quarter: 100, year: 136 };

// ── Time helpers ──────────────────────────────────────────────────────────────
const fmtDate = (s: string | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
  if (!s) return '—';
  const d = s.length === 10 ? new Date(`${s}T00:00:00`) : new Date(s);
  return d.toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
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
        label: `${d.toLocaleString(undefined, { month: 'short' })} '${String(d.getFullYear()).slice(2)}`,
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
  const t = (dateStr.length === 10 ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr)).getTime();
  return clamp((t - rs.getTime()) / (re.getTime() - rs.getTime()) * tw, 0, tw);
}

// ── Main component ─────────────────────────────────────────────────────────────
export const ProjectTimelineTab = ({
  project,
  projectEntities,
  futureSnapshots,
  schemaMap,
  entityTypeColorMap,
  schemas,
  lifecycleStates,
  teams
}: {
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  futureSnapshots: EntitySnapshot[];
  schemaMap: Map<string, SchemaInfo>;
  entityTypeColorMap: Map<string, string>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const [zoom, setZoom] = useState<Zoom>('quarter');
  const [selectedSnap, setSelectedSnap] = useState<EntitySnapshot | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const TODAY = useMemo(() => new Date(), []);

  // Only dated snapshots go on the timeline; undated shown below
  const datedSnapshots = useMemo(() => futureSnapshots.filter(s => s.target_date), [futureSnapshots]);
  const undatedSnapshots = useMemo(() => futureSnapshots.filter(s => !s.target_date), [futureSnapshots]);

  // Snapshots per entity
  const snapsByEntity = useMemo(() => {
    const m = new Map<string, EntitySnapshot[]>();
    for (const s of futureSnapshots) {
      const list = m.get(s.entity_id);
      if (list) list.push(s);
      else m.set(s.entity_id, [s]);
    }
    return m;
  }, [futureSnapshots]);

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
    const dates: Date[] = [TODAY];
    for (const s of datedSnapshots) {
      if (s.target_date) dates.push(new Date(`${s.target_date}T00:00:00`));
    }
    if (dates.length < 2) dates.push(new Date(TODAY.getFullYear() + 1, 0, 1));
    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    const cols = buildCols(minD, maxD, zoom);
    const rs = cols[0]?.date ?? minD;
    const re = cols.length ? colEnd(cols[cols.length - 1]!, zoom) : maxD;
    const tw = cols.reduce((s, c) => s + c.width, 0);
    return { rangeStart: rs, rangeEnd: re, columns: cols, totalWidth: tw };
  }, [datedSnapshots, zoom, TODAY]);

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
    el.scrollLeft = Math.max(0, LABEL_W + todayPx - el.clientWidth * 0.4);
  }, [todayPx]);

  const handleSelect = (snap: EntitySnapshot | null) => {
    setSelectedSnap(prev => (snap?.id === prev?.id ? null : snap));
  };

  const totalEntities = projectEntities.length;
  const markerColor = project.color ?? 'var(--accent-fg)';

  if (futureSnapshots.length === 0) {
    return (
      <div className={styles.ptEmpty}>
        <div className={styles.ptEmptyTitle}>No future changes planned</div>
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
        </div>
        <div className={styles.ptlSep} />
        <span className={styles.ptlConfigMeta}>
          {totalEntities} entities · {futureSnapshots.length} planned
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
        <div className={styles.ptlScroll} ref={scrollRef}>
          <div className={styles.ptlInner} style={{ minWidth: LABEL_W + totalWidth }}>
            {/* Column headers */}
            {datedSnapshots.length > 0 && (
              <>
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

                {/* Today line */}
                {todayPx !== null && (
                  <div className={styles.ptlToday} style={{ left: LABEL_W + todayPx }}>
                    <span className={styles.ptlTodayPip}>▾</span>
                  </div>
                )}

                {/* Entity groups */}
                {[...entityGroups.entries()].map(([typeId, entities]) => {
                  const roleName = entities[0]?.entity_type?.name;
                  const roleColor = typeId !== '__none__' ? entityTypeColorMap.get(typeId) : undefined;
                  return (
                    <div key={typeId}>
                      {/* Group header */}
                      <div className={styles.ptlGrpRow}>
                        <div className={styles.ptlGrpLabel}>
                          {roleColor && (
                            <span className={styles.ptlGrpDot} style={{ background: roleColor }} />
                          )}
                          <span>{roleName ?? 'Other'}</span>
                          <span className={styles.ptlGrpCount}>({entities.length})</span>
                        </div>
                      </div>

                      {/* Entity rows */}
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
                                const px = toPx(snap.target_date, rangeStart, rangeEnd, totalWidth);
                                if (px === null) return null;
                                const isSelected = selectedSnap?.id === snap.id;
                                return (
                                  <div
                                    key={snap.id}
                                    className={`${styles.ptlMarker} ${isSelected ? styles.ptlMarkerSelected : ''}`}
                                    style={{ left: px }}
                                    onClick={() => handleSelect(isSelected ? null : snap)}
                                    title={snap.commit_message ?? snap.status}
                                  >
                                    <span
                                      className={styles.ptlMarkerDiamond}
                                      style={{ background: markerColor }}
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
              </>
            )}

            {/* Undated section */}
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
          </div>
        </div>

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
              markerColor={markerColor}
              lifecycleStates={lifecycleStates}
              teams={teams}
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
  onClose
}: {
  snapshot: EntitySnapshot;
  entityName: string;
  schemaInfo: SchemaInfo | undefined;
  entitySchema: EntitySchema | null;
  markerColor: string;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  onClose: () => void;
}) => {
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
            Planned
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
          <span>{fmtDate(snapshot.created_at, { month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
};
