import { TbX, TbChevronRight } from 'react-icons/tb';
import styles from './TimelineView.module.css';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { Button } from '@diagram-craft/app-components/Button';
import { formatTimelineDate } from '../../../components/timeline/timelineUtils';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { FieldOption } from './entityFieldSources';
import { getSnapshotDateLabel } from './snapshotDisplay';
import {
  dotCommitMessage,
  dotCreatedAt,
  dotProjectId,
  dotStatus,
  type TimelineDot
} from './TimelineSnapshotRows';
import { getDateValue, getRawDateValue, type TimelineConfig } from './timelineViewTypes';

const SNAP_STATUS_CLASS: Record<string, string> = {
  autosave: styles.snapStatusAutosave ?? '',
  saved_version: styles.snapStatusSavedVersion ?? '',
  future_update: styles.snapStatusFutureUpdate ?? '',
  applied: styles.snapStatusApplied ?? ''
};

const SNAP_STATUS_LABEL: Record<string, string> = {
  autosave: 'Autosave',
  saved_version: 'Saved version',
  future_update: 'Planned change',
  applied: 'Applied'
};

// ── Snap detail panel ─────────────────────────────────────────────────────────

export const SnapDetailPanel = ({
  detail,
  isLinked,
  projects,
  milestonesById,
  schemaMap,
  lifecycleStates,
  onEntityClick,
  onClose
}: {
  detail: { snap: TimelineDot; entity: EntityRecord } | null;
  isLinked: boolean;
  projects: Project[];
  milestonesById: Map<string, Milestone>;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
  onEntityClick: (id: string) => void;
  onClose: () => void;
}) => {
  const { snap, entity } = detail ?? {};
  const s = entity ? schemaMap.get(entity._schema.id) : null;
  const snapProjectId = snap ? dotProjectId(snap) : null;
  const project = snapProjectId ? projects.find(p => p.id === snapProjectId) : null;
  const snapStatus = snap ? dotStatus(snap) : null;
  const snapCommitMessage = snap ? dotCommitMessage(snap) : null;

  return (
    <div className={`${styles.detail} ${detail ? styles.detailOpen : ''}`}>
      {detail && snap && entity && (
        <>
          <div className={styles.detailHead}>
            {s && (
              <TypeBadge
                color={resolveSchemaColor(s.schema, s.index)}
                name={s.schema.name}
                icon={s.schema.icon}
                size={22}
              />
            )}
            <div className={styles.detailMeta}>
              <div
                className={styles.detailName}
                style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
              >
                {entity._name ?? entity._slug}
              </div>
              {s && <div className={styles.detailType}>{s.schema.name}</div>}
            </div>
            <button type="button" className={styles.detailCloseBtn} onClick={onClose} title="Close">
              <TbX size={12} />
            </button>
          </div>

          <div className={styles.detailBody}>
            <div className={styles.detailField}>
              <div className={styles.detailFieldLabel}>Snapshot type</div>
              <span
                className={`${styles.snapStatusBadge} ${(snapStatus && SNAP_STATUS_CLASS[snapStatus]) ?? ''}`}
              >
                {(snapStatus && SNAP_STATUS_LABEL[snapStatus]) ?? snapStatus}
              </span>
            </div>

            {project && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Project</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: project.color ?? 'var(--accent-fg)',
                      flexShrink: 0
                    }}
                  />
                  <span className={styles.detailFieldValue}>{project.name}</span>
                </div>
              </div>
            )}

            <div className={styles.detailField}>
              <div className={styles.detailFieldLabel}>
                {snap && snap.source === 'project'
                  ? snap.entry.changeCase.milestone_id
                    ? 'Milestone'
                    : 'Target date'
                  : 'Captured'}
              </div>
              <div className={styles.detailFieldValue}>
                {snap && snap.source === 'project'
                  ? (getSnapshotDateLabel(snap.entry.changeCase, milestonesById) ?? '—')
                  : formatTimelineDate(snap ? dotCreatedAt(snap) : null)}
              </div>
            </div>

            {snapCommitMessage && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Note</div>
                <p className={styles.detailDesc}>{snapCommitMessage}</p>
              </div>
            )}

            {entity._lifecycle && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Entity status</div>
                <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
              </div>
            )}
          </div>

          <div className={styles.detailFooter}>
            <Button variant="primary" size="sm" onClick={() => onEntityClick(entity._publicId)}>
              Open entity <TbChevronRight size={11} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
export const DetailPanel = ({
  entity,
  isLinked,
  cfg,
  dateFields,
  schemaMap,
  onOpen,
  onClose
}: {
  entity: EntityRecord | null;
  isLinked: boolean;
  cfg: TimelineConfig;
  dateFields: FieldOption[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onOpen: () => void;
  onClose: () => void;
}) => {
  const s = entity ? schemaMap.get(entity._schema.id) : null;
  const startField = dateFields.find(f => f.id === cfg.startFieldId);
  const endField = dateFields.find(f => f.id === cfg.endFieldId);
  const startVal = entity ? getRawDateValue(entity, cfg.startFieldId) : null;
  const endVal = entity ? getRawDateValue(entity, cfg.endFieldId) : null;
  const isMilestone = entity
    ? !getDateValue(entity, cfg.startFieldId) && !!getDateValue(entity, cfg.endFieldId)
    : false;

  return (
    <div className={`${styles.detail} ${entity ? styles.detailOpen : ''}`}>
      {entity && (
        <>
          <div className={styles.detailHead}>
            {s && (
              <TypeBadge
                color={resolveSchemaColor(s.schema, s.index)}
                name={s.schema.name}
                icon={s.schema.icon}
                size={22}
              />
            )}
            <div className={styles.detailMeta}>
              <div
                className={styles.detailName}
                style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
              >
                {entity._name ?? entity._slug}
              </div>
              {s && <div className={styles.detailType}>{s.schema.name}</div>}
            </div>
            <button type="button" className={styles.detailCloseBtn} onClick={onClose} title="Close">
              <TbX size={12} />
            </button>
          </div>

          <div className={styles.detailBody}>
            {!isMilestone && startField && !!startVal && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>{startField.label}</div>
                <div className={styles.detailFieldValue}>{formatTimelineDate(startVal)}</div>
              </div>
            )}
            {endField && !!endVal && (
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>
                  {isMilestone ? `Target (${endField.label})` : endField.label}
                </div>
                <div className={styles.detailFieldValue}>{formatTimelineDate(endVal)}</div>
              </div>
            )}
          </div>

          <div className={styles.detailFooter}>
            <Button variant="primary" size="sm" onClick={onOpen}>
              Open entity <TbChevronRight size={11} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
