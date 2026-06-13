import { useState, useMemo } from 'react';
import {
  TbBookmark,
  TbClock,
  TbCalendarEvent,
  TbCheck,
  TbAlertTriangle,
  TbChevronDown,
  TbChevronRight
} from 'react-icons/tb';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Project, ProjectEntity } from '@arch-register/api-types/projectContract';
import styles from './EntityDetailScreen.module.css';

type EntityProject = { project: Project; entity_type: ProjectEntity['entity_type'] };

const fmtDate = (ts: string) => new Date(ts).toLocaleDateString();
const fmtTarget = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString() : null;

const AUTOSAVE_CAP = 5;

export const EntityTimelineTab = ({
  allSnapshots,
  entityProjects,
  schema
}: {
  allSnapshots: EntitySnapshot[];
  entityProjects: EntityProject[];
  schema: EntitySchema | null;
}) => {
  const ownHistory = useMemo(
    () =>
      allSnapshots
        .filter(s => s.status === 'autosave' || s.status === 'saved_version')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allSnapshots]
  );

  const projectGroups = useMemo(() => {
    const groups = new Map<string, EntitySnapshot[]>();
    for (const snap of allSnapshots) {
      if (snap.status !== 'future_update' && snap.status !== 'applied') continue;
      if (!snap.project_id) continue;
      const list = groups.get(snap.project_id);
      if (list) list.push(snap);
      else groups.set(snap.project_id, [snap]);
    }
    return groups;
  }, [allSnapshots]);

  const futureUpdates = useMemo(
    () => allSnapshots.filter(s => s.status === 'future_update'),
    [allSnapshots]
  );

  const hasConflict =
    new Set(futureUpdates.map(s => s.project_id).filter(Boolean)).size > 1;

  const conflictingFields = useMemo(() => {
    if (!hasConflict || !schema) return [];
    const fieldProjectValues = new Map<string, Map<string, string>>();
    for (const snap of futureUpdates) {
      if (!snap.project_id || !snap.proposed_state) continue;
      for (const [fieldId, val] of Object.entries(snap.proposed_state)) {
        if (!fieldProjectValues.has(fieldId)) fieldProjectValues.set(fieldId, new Map());
        fieldProjectValues.get(fieldId)!.set(snap.project_id, JSON.stringify(val));
      }
    }
    const conflictNames: string[] = [];
    for (const [fieldId, projVals] of fieldProjectValues) {
      if (new Set(projVals.values()).size > 1) {
        const field = schema.fields.find(f => f.id === fieldId);
        conflictNames.push(field?.name ?? fieldId);
      }
    }
    return conflictNames;
  }, [hasConflict, futureUpdates, schema]);

  const projectNameMap = useMemo(
    () => new Map(entityProjects.map(ep => [ep.project.id, ep.project.name])),
    [entityProjects]
  );

  if (allSnapshots.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No snapshot history yet</div>
        <div>Snapshots are created automatically when the entity is saved.</div>
      </div>
    );
  }

  return (
    <div className={styles.timelinePage}>
      {hasConflict && (
        <div className={styles.timelineConflictBanner}>
          <TbAlertTriangle size={14} />
          <span>
            Multiple projects plan changes to this entity
            {conflictingFields.length > 0
              ? ` — competing changes to: ${conflictingFields.join(', ')}`
              : ''}
          </span>
        </div>
      )}

      <OwnHistoryLane ownHistory={ownHistory} />

      {[...projectGroups.entries()].map(([projectId, snaps]) => (
        <ProjectLane
          key={projectId}
          projectName={projectNameMap.get(projectId) ?? projectId}
          snapshots={snaps}
        />
      ))}
    </div>
  );
};

const OwnHistoryLane = ({ ownHistory }: { ownHistory: EntitySnapshot[] }) => {
  const [showAllAutosaves, setShowAllAutosaves] = useState(false);

  const autosaveCount = ownHistory.filter(s => s.status === 'autosave').length;
  const hiddenCount = Math.max(0, autosaveCount - AUTOSAVE_CAP);

  let autosavesSeen = 0;
  const displayed = ownHistory.filter(snap => {
    if (snap.status === 'saved_version') return true;
    autosavesSeen++;
    return showAllAutosaves || autosavesSeen <= AUTOSAVE_CAP;
  });

  return (
    <div className={styles.timelineLane}>
      <div className={styles.timelineLaneHead}>
        <TbClock size={13} />
        <span>Own history</span>
        <span className={styles.timelineLaneBadge}>{ownHistory.length} entries</span>
      </div>
      <div className={styles.timelineEntries}>
        {displayed.map(snap => (
          <TimelineEntry key={snap.id} snap={snap} />
        ))}
        {!showAllAutosaves && hiddenCount > 0 && (
          <button
            type="button"
            className={styles.timelineShowMore}
            onClick={() => setShowAllAutosaves(true)}
          >
            Show {hiddenCount} more autosave{hiddenCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
};

const ProjectLane = ({
  projectName,
  snapshots
}: {
  projectName: string;
  snapshots: EntitySnapshot[];
}) => {
  const hasActiveFuture = snapshots.some(s => s.status === 'future_update');
  const [expanded, setExpanded] = useState(hasActiveFuture);

  const sorted = [...snapshots].sort((a, b) => {
    if (a.status === 'future_update' && b.status !== 'future_update') return -1;
    if (a.status !== 'future_update' && b.status === 'future_update') return 1;
    const aKey = a.target_date ?? a.created_at;
    const bKey = b.target_date ?? b.created_at;
    return aKey.localeCompare(bKey);
  });

  const futureCount = snapshots.filter(s => s.status === 'future_update').length;

  return (
    <div
      className={`${styles.timelineLane} ${!hasActiveFuture ? styles.timelineLaneInactive : ''}`}
    >
      <button
        type="button"
        className={styles.timelineLaneHead}
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <TbChevronDown size={13} /> : <TbChevronRight size={13} />}
        <TbCalendarEvent size={13} />
        <span>{projectName}</span>
        {hasActiveFuture ? (
          <span className={styles.timelineLaneBadge}>
            {futureCount} planned
          </span>
        ) : (
          <span className={styles.timelineLaneBadge}>no pending changes</span>
        )}
      </button>
      {expanded && (
        <div className={styles.timelineEntries}>
          {sorted.map(snap => (
            <TimelineEntry key={snap.id} snap={snap} />
          ))}
        </div>
      )}
    </div>
  );
};

const TimelineEntry = ({ snap }: { snap: EntitySnapshot }) => {
  const isSavedVersion = snap.status === 'saved_version';
  const isAutosave = snap.status === 'autosave';
  const isFuture = snap.status === 'future_update';
  const isApplied = snap.status === 'applied';

  return (
    <div
      className={[
        styles.timelineEntry,
        isAutosave ? styles.timelineEntryDim : '',
        isFuture ? styles.timelineEntryFuture : '',
        isApplied ? styles.timelineEntryApplied : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.timelineEntryDot}>
        {isSavedVersion && <TbBookmark size={10} />}
        {isAutosave && <span className={styles.timelineDotSmall} />}
        {isFuture && <TbCalendarEvent size={10} />}
        {isApplied && <TbCheck size={10} />}
      </div>
      <div className={styles.timelineEntryBody}>
        <div className={styles.timelineEntryRow}>
          <span className={styles.timelineEntryLabel}>
            {isSavedVersion && (snap.commit_message ?? 'Saved version')}
            {isAutosave && 'Autosave'}
            {isFuture && (snap.commit_message ?? 'Planned change')}
            {isApplied && (snap.commit_message ?? 'Applied')}
          </span>
          <span className={styles.timelineEntryDate}>
            {isFuture && snap.target_date
              ? `→ ${fmtTarget(snap.target_date)}`
              : fmtDate(snap.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};
