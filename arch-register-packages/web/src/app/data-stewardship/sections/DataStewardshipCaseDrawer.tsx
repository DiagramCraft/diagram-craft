import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { useGovernanceCase } from '../../../hooks/useGovernance';
import { useEntity } from '../../../hooks/useEntities';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { caseKindLabel, humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { queueItemPriority, type DataStewardshipQueuePriority } from '../dataStewardshipQueue';
import { DS_RAIL_PATHS, DS_STEWARDSHIP_ID } from '../dataStewardshipSections';
// Reuses `DatasetDrawer`'s content classes (`sectionLabel`/`attributeRow`/`empty`) rather than
// duplicating them — both drawers render the same "label above a row of key/value attributes"
// shape.
import styles from './DatasetDrawer.module.css';

const PRIORITY_LABEL: Record<DataStewardshipQueuePriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const PRIORITY_TONE: Record<DataStewardshipQueuePriority, string> = {
  high: 'var(--cmp-fg-danger, #ef4444)',
  medium: 'var(--cmp-fg-warning, #eab308)',
  low: 'var(--cmp-fg-dim, #9ca3af)'
};

const formatTimestamp = (value: string | null): string =>
  value == null ? '—' : new Date(value).toLocaleString();

/**
 * Minimal, read-only drawer for a single governance case (#3298's "or the case drawer when the
 * item references a change case") — case identity, dates, and the dataset it concerns, plus a
 * link out to the entity. Deliberately doesn't duplicate `GovernanceInboxScreen.tsx`'s
 * decide/withdraw/remind actions or approval-chain display; those stay on the workspace-wide
 * governance inbox. A fuller case drawer (approval chain, decisions) is a possible future
 * enhancement, not required for this My work queue.
 */
export const DataStewardshipCaseDrawer = ({
  workspaceSlug,
  caseId,
  onClose
}: {
  workspaceSlug: string;
  caseId: string;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const governanceCase = useGovernanceCase(workspaceSlug, caseId);
  const dataset = useEntity(workspaceSlug, governanceCase.data?.subjectId ?? '');

  if (governanceCase.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading case…</div>
      </Drawer>
    );
  }
  if (governanceCase.isError || !governanceCase.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This case is unavailable.</div>
      </Drawer>
    );
  }

  const kase = governanceCase.data;
  const priority = queueItemPriority(kase);
  const datasetEntity = kase.subjectType === 'entity' ? dataset.data : undefined;

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{humanizeCaseKind(kase.status)}</span>}
      title={caseKindLabel(kase.caseKind, kase.payload)}
      badges={
        <Chip tone="ghost" color={PRIORITY_TONE[priority]}>
          {PRIORITY_LABEL[priority]}
        </Chip>
      }
      footer={
        datasetEntity && (
          <Button
            variant="primary"
            onClick={() =>
              navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(datasetEntity._publicId)))
            }
          >
            Open record in Entities
          </Button>
        )
      }
    >
      <div className={styles.sectionLabel}>Case</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Status</span>
        <span>{humanizeCaseKind(kase.status)}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Created</span>
        <span>{formatTimestamp(kase.createdAt)}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Due</span>
        <span style={{ color: dueTone(kase.dueAt) }}>{dueLabel(kase.dueAt)}</span>
      </div>
      {kase.escalatedAt && (
        <div className={styles.attributeRow}>
          <span className={styles.attributeLabel}>Escalated</span>
          <span style={{ color: PRIORITY_TONE.high }}>{formatTimestamp(kase.escalatedAt)}</span>
        </div>
      )}
      {kase.outcome && (
        <div className={styles.attributeRow}>
          <span className={styles.attributeLabel}>Outcome</span>
          <span>{humanizeCaseKind(kase.outcome)}</span>
        </div>
      )}

      <div className={styles.sectionLabel}>Dataset in scope</div>
      {kase.subjectType !== 'entity' ? (
        <span className="dim">This case doesn't reference a single dataset.</span>
      ) : dataset.isLoading ? (
        <span className="dim">Loading…</span>
      ) : datasetEntity ? (
        <button
          type="button"
          className={styles.attributeRow}
          style={{ width: '100%', cursor: 'pointer', background: 'none', border: 'none' }}
          onClick={() =>
            navigate({
              to: DS_RAIL_PATHS[DS_STEWARDSHIP_ID],
              params: { workspaceSlug },
              search: (previous: Record<string, unknown>) => ({
                ...previous,
                datasetId: datasetEntity._publicId
              })
            })
          }
        >
          <span>{datasetEntity._name}</span>
          <span className="dim mono">{datasetEntity._publicId}</span>
        </button>
      ) : (
        <span className="dim">Dataset unavailable.</span>
      )}
    </Drawer>
  );
};
