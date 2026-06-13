import { Fragment, useMemo } from 'react';
import { TbCalendarEvent } from 'react-icons/tb';
import type { ProjectEntity } from '@arch-register/api-types/projectContract';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import { TypeBadge } from '../../components/TypeBadge';
import styles from './ProjectDetailScreen.module.css';

type SchemaInfo = { color: string; icon: string | null };

const getYearMonth = (dateStr: string) => dateStr.slice(0, 7);

const formatYearMonth = (ym: string) => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric'
  });
};

export const ProjectTimelineTab = ({
  projectEntities,
  futureSnapshots,
  schemaMap,
  entityTypeColorMap
}: {
  projectEntities: ProjectEntity[];
  futureSnapshots: EntitySnapshot[];
  schemaMap: Map<string, SchemaInfo>;
  entityTypeColorMap: Map<string, string>;
}) => {
  const pending = useMemo(
    () => futureSnapshots.filter(s => s.status === 'future_update'),
    [futureSnapshots]
  );
  const datedSnapshots = useMemo(() => pending.filter(s => s.target_date), [pending]);
  const undatedSnapshots = useMemo(() => pending.filter(s => !s.target_date), [pending]);

  const monthBuckets = useMemo(() => {
    const months = new Set(datedSnapshots.map(s => getYearMonth(s.target_date!)));
    return [...months].sort();
  }, [datedSnapshots]);

  const snapshotsByEntity = useMemo(() => {
    const m = new Map<string, EntitySnapshot[]>();
    for (const s of pending) {
      const list = m.get(s.entity_id);
      if (list) list.push(s);
      else m.set(s.entity_id, [s]);
    }
    return m;
  }, [pending]);

  const entitiesWithDateSet = useMemo(
    () => new Set(datedSnapshots.map(s => s.entity_id)),
    [datedSnapshots]
  );

  // Group entities that have dated changes by entity_type (role)
  const entityGroups = useMemo(() => {
    const groups = new Map<string, ProjectEntity[]>();
    for (const e of projectEntities) {
      if (!entitiesWithDateSet.has(e.entity_id)) continue;
      const key = e.entity_type?.id ?? '__none__';
      const list = groups.get(key);
      if (list) list.push(e);
      else groups.set(key, [e]);
    }
    return groups;
  }, [projectEntities, entitiesWithDateSet]);

  if (pending.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No future changes planned</div>
        <div>Use the entity menu to plan future changes for entities in this project.</div>
      </div>
    );
  }

  return (
    <div className={styles.projectTimeline}>
      {monthBuckets.length > 0 && (
        <div
          className={styles.ptGrid}
          style={{
            gridTemplateColumns: `220px repeat(${monthBuckets.length}, minmax(100px, 1fr))`
          }}
        >
          {/* Column headers */}
          <div className={styles.ptHeaderCell} />
          {monthBuckets.map(ym => (
            <div key={ym} className={styles.ptHeaderCell}>
              {formatYearMonth(ym)}
            </div>
          ))}

          {/* Entity groups */}
          {[...entityGroups.entries()].map(([typeId, entities]) => {
            const roleName = entities[0]?.entity_type?.name;
            const roleColor = typeId !== '__none__' ? entityTypeColorMap.get(typeId) : undefined;
            return (
              <Fragment key={typeId}>
                {roleName && (
                  <div
                    className={styles.ptGroupLabel}
                    style={
                      roleColor
                        ? ({ '--role-color': roleColor } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {roleName}
                  </div>
                )}
                {entities.map(entity => {
                  const schema = entity.entity_schema
                    ? schemaMap.get(entity.entity_schema.id)
                    : undefined;
                  const entitySnaps = snapshotsByEntity.get(entity.entity_id) ?? [];
                  return (
                    <Fragment key={entity.entity_id}>
                      <div className={styles.ptEntityCell}>
                        {schema && (
                          <TypeBadge color={schema.color} icon={schema.icon} size={14} />
                        )}
                        <span className={styles.ptEntityName}>{entity.entity_name}</span>
                      </div>
                      {monthBuckets.map(ym => {
                        const colSnaps = entitySnaps.filter(
                          s => s.target_date && getYearMonth(s.target_date) === ym
                        );
                        return (
                          <div key={ym} className={styles.ptMonthCell}>
                            {colSnaps.map(snap => (
                              <div
                                key={snap.id}
                                className={styles.ptMarker}
                                title={snap.commit_message ?? undefined}
                              >
                                <TbCalendarEvent size={10} />
                                {snap.commit_message && (
                                  <span className={styles.ptMarkerLabel}>
                                    {snap.commit_message}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      )}

      {undatedSnapshots.length > 0 && (
        <div className={styles.ptUndated}>
          <div className={styles.ptUndatedLabel}>No target date</div>
          {undatedSnapshots.map(snap => {
            const entity = projectEntities.find(e => e.entity_id === snap.entity_id);
            const schema = entity?.entity_schema
              ? schemaMap.get(entity.entity_schema.id)
              : undefined;
            return (
              <div key={snap.id} className={styles.ptUndatedRow}>
                {schema && <TypeBadge color={schema.color} icon={schema.icon} size={14} />}
                <span className={styles.ptEntityName}>
                  {entity?.entity_name ?? snap.entity_id}
                </span>
                {snap.commit_message && (
                  <span className={styles.ptUndatedNote}>{snap.commit_message}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
