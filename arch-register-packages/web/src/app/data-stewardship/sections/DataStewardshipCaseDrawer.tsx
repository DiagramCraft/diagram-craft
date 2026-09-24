import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import {
  useDecideGovernanceAssignment,
  useGovernanceCase,
  useGovernanceTasks
} from '../../../hooks/useGovernance';
import { useEntity } from '../../../hooks/useEntities';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { caseKindLabel, humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { formatDateTime } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { queueItemPriority, type DataStewardshipQueuePriority } from '../dataStewardshipQueue';
// Reuses the data-stewardship drawer content classes (`sectionLabel`/`attributeRow`/`empty`) rather than
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

// Cases of these kinds can be sent back for revision rather than only approved/rejected outright —
// mirrors `GovernanceInboxScreen.tsx`'s own `requestChanges` affordance exactly (same case kinds,
// same "only on an 'approve' action" gate), so a request-changes case initiated here behaves
// identically wherever it's later reviewed.
const REQUEST_CHANGES_CASE_KINDS = new Set([
  'entity.change-case',
  'entity.change-case.bulk',
  'document.status'
]);

/**
 * Drawer for a single governance case, opened from every row in Data Stewardship's "My work" queue
 * (#3298) — not just change-case/deprecation rows, since a review-date reminder is just as much a
 * governance case the user may need to act on (typically by acknowledging it). Shows case identity,
 * dates, the dataset it concerns, and — when the current user holds an open, actionable assignment
 * on this case — the same decision actions `GovernanceInboxScreen.tsx` offers (Approve/Acknowledge,
 * plus Request changes on the same case kinds that screen allows it for), reusing that screen's own
 * `useDecideGovernanceAssignment` mutation so a decision made here is identical in effect to one
 * made from the workspace-wide governance inbox.
 *
 * Finding "my assignment" for this case reuses `useGovernanceTasks(workspace, { state: 'open' })` —
 * the same query (and cache entry) the "Assigned to me" queue scope already fetches — rather than a
 * dedicated per-case lookup endpoint, which doesn't exist. A case opened from the "All open items"/
 * "Past due" scopes therefore only shows actions when the current user also happens to hold the
 * open assignment; otherwise it's a read-only view of the case (still useful — dates, status,
 * dataset), consistent with this queue having no way to know an arbitrary case's assignee (see
 * `dataStewardshipQueue.ts`'s doc comment on the dropped Assignee facet).
 *
 * Deliberately doesn't add Withdraw/Send reminder — both are initiator-only conveniences already
 * available on the workspace-wide governance inbox; adding them here without a "is this user the
 * initiator" check client-side would show a button that fails server-side for most viewers.
 */
export const DataStewardshipCaseDrawer = ({
  workspaceSlug,
  caseId,
  onClose,
  onOpenDataset
}: {
  workspaceSlug: string;
  caseId: string;
  onClose: () => void;
  /** Switches to the shared dataset drawer for this case's subject, staying within My work rather
   *  than navigating to the Stewardship section — only `DataStewardshipMyWorkScreen.tsx` wires
   *  this; other openers of this drawer fall back to the app-wide `useEntityDrawer()` stack. */
  onOpenDataset?: (datasetPublicId: string) => void;
}) => {
  const { openEntityDrawer } = useEntityDrawer();
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const formatTimestamp = (value: string | null): string =>
    value == null ? '—' : formatDateTime(value, '—', dateTimeFormatPreference);
  const governanceCase = useGovernanceCase(workspaceSlug, caseId);
  const dataset = useEntity(workspaceSlug, governanceCase.data?.subjectId ?? '');
  const myTasks = useGovernanceTasks(workspaceSlug, { state: 'open' });
  const decide = useDecideGovernanceAssignment(workspaceSlug);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesReason, setRequestChangesReason] = useState('');

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

  const myTask = (myTasks.data ?? []).find(task => task.case.id === caseId);
  const decision =
    myTask?.assignment.action === 'approve'
      ? 'approve'
      : myTask?.assignment.action === 'acknowledge'
        ? 'acknowledge'
        : null;
  const canDecide = !!myTask?.requiresAction && decision != null;
  const canRequestChanges =
    canDecide && decision === 'approve' && REQUEST_CHANGES_CASE_KINDS.has(kase.caseKind);

  const submitDecision = (chosenDecision: 'approve' | 'acknowledge', reason?: string) => {
    if (!myTask) return;
    decide.mutate(
      { assignmentId: myTask.assignment.id, decision: chosenDecision, reason },
      { onSuccess: onClose }
    );
  };

  const submitRequestChanges = () => {
    if (!myTask) return;
    const reason = requestChangesReason.trim();
    if (reason === '') return;
    decide.mutate(
      { assignmentId: myTask.assignment.id, decision: 'request_changes', reason },
      {
        onSuccess: () => {
          setRequestChangesOpen(false);
          setRequestChangesReason('');
          onClose();
        }
      }
    );
  };

  const openDataset = () => {
    if (!datasetEntity) return;
    if (onOpenDataset) onOpenDataset(datasetEntity._publicId);
    else openEntityDrawer(datasetEntity._publicId);
  };

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
        <>
          {canDecide && (
            <Button
              variant="primary"
              disabled={decide.isPending}
              onClick={() => submitDecision(decision!)}
            >
              {decision === 'approve' ? 'Approve' : 'Acknowledge'}
            </Button>
          )}
          {canRequestChanges && (
            <Button
              disabled={decide.isPending}
              onClick={() => {
                setRequestChangesReason('');
                setRequestChangesOpen(true);
              }}
            >
              Request changes
            </Button>
          )}
          {datasetEntity && (
            <Button variant={canDecide ? 'secondary' : 'primary'} onClick={openDataset}>
              {onOpenDataset ? 'Open dataset' : 'Open record in Entities'}
            </Button>
          )}
        </>
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
      {myTask && (
        <div className={styles.attributeRow}>
          <span className={styles.attributeLabel}>Waiting on you</span>
          <span>{canDecide ? humanizeCaseKind(myTask.assignment.action) : 'No action needed'}</span>
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
          onClick={openDataset}
        >
          <span>{datasetEntity._name}</span>
          <span className="dim mono">{datasetEntity._publicId}</span>
        </button>
      ) : (
        <span className="dim">Dataset unavailable.</span>
      )}

      <Dialog
        open={requestChangesOpen}
        onClose={() => setRequestChangesOpen(false)}
        title="Request changes?"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setRequestChangesOpen(false) },
          {
            label: decide.isPending ? 'Submitting…' : 'Request changes',
            type: 'default',
            disabled: decide.isPending || requestChangesReason.trim() === '',
            onClick: submitRequestChanges
          }
        ]}
      >
        <p>The proposer will be notified and can revise and resubmit this proposal.</p>
        <FormElement label="Reason" required>
          <TextInput
            value={requestChangesReason}
            onChange={value => setRequestChangesReason(value ?? '')}
            placeholder="Explain what needs to change"
            style={{ width: '100%' }}
          />
        </FormElement>
      </Dialog>
    </Drawer>
  );
};
