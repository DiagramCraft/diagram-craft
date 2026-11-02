import styles from './TimelineView.module.css';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { Button } from '@diagram-craft/app-components/Button';
import { Drawer } from '../../../components/Drawer';
import { formatTimelineDate } from '../../../components/timeline/timelineUtils';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { FieldOption } from './entityFieldSources';
import {
  dotCommitMessage,
  dotCreatedAt,
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
  schemaMap,
  lifecycleStates,
  onEntityClick,
  onClose
}: {
  detail: { snap: TimelineDot; entity: EntityRecord } | null;
  isLinked: boolean;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
  onEntityClick: (id: string) => void;
  onClose: () => void;
}) => {
  const { snap, entity } = detail ?? {};
  const s = entity ? schemaMap.get(entity._schema.id) : null;
  const snapStatus = snap ? dotStatus(snap) : null;
  const snapCommitMessage = snap ? dotCommitMessage(snap) : null;

  if (!detail || !snap || !entity) return null;

  return (
    <Drawer
      key={snap.id}
      onClose={onClose}
      eyebrow={
        s && (
          <>
            <TypeBadge
              color={resolveSchemaColor(s.schema, s.index)}
              name={s.schema.name}
              icon={s.schema.icon}
              size={18}
            />
            <span>{s.schema.name}</span>
          </>
        )
      }
      title={
        <span style={isLinked ? undefined : { color: 'var(--base-fg-dimmed)' }}>
          {entity._name ?? entity._slug}
        </span>
      }
      badges={
        <span
          className={`${styles.snapStatusBadge} ${(snapStatus && SNAP_STATUS_CLASS[snapStatus]) ?? ''}`}
        >
          {(snapStatus && SNAP_STATUS_LABEL[snapStatus]) ?? snapStatus}
        </span>
      }
      footer={
        <Button variant="primary" size="sm" onClick={() => onEntityClick(entity._publicId)}>
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.detailBody}>
        <div className={styles.detailField}>
          <div className={styles.detailFieldLabel}>Captured</div>
          <div className={styles.detailFieldValue}>{formatTimelineDate(dotCreatedAt(snap))}</div>
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
    </Drawer>
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

  if (!entity) return null;

  return (
    <Drawer
      key={entity._uid}
      onClose={onClose}
      eyebrow={
        s && (
          <>
            <TypeBadge
              color={resolveSchemaColor(s.schema, s.index)}
              name={s.schema.name}
              icon={s.schema.icon}
              size={18}
            />
            <span>{s.schema.name}</span>
          </>
        )
      }
      title={
        <span style={isLinked ? undefined : { color: 'var(--base-fg-dimmed)' }}>
          {entity._name ?? entity._slug}
        </span>
      }
      footer={
        <Button variant="primary" size="sm" onClick={onOpen}>
          Open record in Entities
        </Button>
      }
    >
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
    </Drawer>
  );
};
