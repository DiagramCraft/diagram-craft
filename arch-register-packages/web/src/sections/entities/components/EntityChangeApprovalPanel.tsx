import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useAuth } from '../../../auth/AuthContext';
import { useBypassEntityApproval } from '../../../hooks/useEntityChanges';
import {
  useDecideGovernanceAssignment,
  useGovernanceCaseEvents,
  useGovernanceTasks
} from '../../../hooks/useGovernance';
import { invalidateEntityChangeQueries } from '../../../queries/entityChanges';
import { changeApprovalDiffRows, formatChangeApprovalValue } from './entityChangeApprovalHelpers';
import styles from '../EntityDetailScreen.module.css';
import type { EntityChangeApprovalRevision } from '@arch-register/api-types/entityChangeContract';

const changeApprovalStatusLabels: Record<EntityChangeApprovalRevision['status'], string> = {
  submitted: 'Awaiting approval',
  changes_requested: 'Changes requested',
  stale: 'Stale · resubmit required',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

type Props = {
  revision: EntityChangeApprovalRevision;
  workspaceId: string;
  entityId: string;
  canOverrideApproval: boolean;
};

export const EntityChangeApprovalPanel = ({
  revision,
  workspaceId,
  entityId,
  canOverrideApproval
}: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bypass = useBypassEntityApproval(workspaceId, entityId);
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);
  const [bypassReason, setBypassReason] = useState('');
  const [requestChangesDialogOpen, setRequestChangesDialogOpen] = useState(false);
  const [requestChangesReason, setRequestChangesReason] = useState('');
  const { data: governanceTasks = [] } = useGovernanceTasks(workspaceId, {
    caseKind: 'entity.change',
    state: 'open'
  });
  const { data: caseEvents = [] } = useGovernanceCaseEvents(
    workspaceId,
    revision.status === 'changes_requested' ? revision.caseId : null
  );
  const decide = useDecideGovernanceAssignment(workspaceId);
  const approvalTask = governanceTasks.find(
    task =>
      task.case.id === revision.caseId &&
      task.assignment.action === 'approve' &&
      task.requiresAction &&
      (task.case.initiatorUserId !== user?.id || task.case.selfApprovalAllowed)
  );
  const status = changeApprovalStatusLabels[revision.status];
  const rows = changeApprovalDiffRows(revision);
  const requestedChangesReason = [...caseEvents]
    .reverse()
    .find(caseEvent => caseEvent.eventType === 'changes_requested')?.reason;
  const invalidateProposalQueries = () =>
    invalidateEntityChangeQueries(queryClient, workspaceId, entityId);
  const approve = () => {
    if (!approvalTask) return;
    decide.mutate(
      { assignmentId: approvalTask.assignment.id, decision: 'approve' },
      { onSuccess: invalidateProposalQueries }
    );
  };
  const executeRequestChanges = () => {
    if (!approvalTask) return;
    const reason = requestChangesReason.trim();
    if (reason === '') return;
    decide.mutate(
      { assignmentId: approvalTask.assignment.id, decision: 'request_changes', reason },
      {
        onSuccess: async () => {
          await invalidateProposalQueries();
          setRequestChangesDialogOpen(false);
          setRequestChangesReason('');
        }
      }
    );
  };
  const executeBypass = () => {
    const reason = bypassReason.trim();
    if (reason === '') return;
    bypass.mutate(
      {
        baseVersion: revision.baseVersion,
        proposedState: revision.proposedState,
        reason
      },
      {
        onSuccess: () => {
          setBypassDialogOpen(false);
          setBypassReason('');
        }
      }
    );
  };
  return (
    <>
      <section className={styles.proposalPanel} aria-labelledby="entity-change-proposal-title">
        <div className={styles.proposalHeader}>
          <div>
            <div className={styles.proposalEyebrow}>Entity change proposal</div>
            <h2 id="entity-change-proposal-title" className={styles.proposalTitle}>
              Revision {revision.revisionNumber}
            </h2>
            <div className={styles.proposalMeta}>
              Proposed by {revision.createdByName ?? 'Unknown user'} ·{' '}
              {new Date(revision.createdAt).toLocaleString()}
            </div>
          </div>
          <div className={styles.proposalActions}>
            <span className={styles.proposalStatus}>{status}</span>
            {approvalTask && (
              <>
                <Button variant="primary" onClick={approve} disabled={decide.isPending}>
                  {decide.isPending ? 'Approving…' : 'Approve change'}
                </Button>
                <Button
                  onClick={() => setRequestChangesDialogOpen(true)}
                  disabled={decide.isPending}
                >
                  Request changes
                </Button>
              </>
            )}
            {canOverrideApproval && (
              <Button
                variant="danger"
                onClick={() => setBypassDialogOpen(true)}
                disabled={bypass.isPending}
              >
                Bypass approval
              </Button>
            )}
          </div>
        </div>
        {revision.message && <p className={styles.proposalMessage}>{revision.message}</p>}
        {revision.status === 'changes_requested' && requestedChangesReason && (
          <p className={styles.proposalMessage}>
            <strong>Reviewer requested changes:</strong> {requestedChangesReason}
          </p>
        )}
        <div className={styles.proposalDiff}>
          <div className={styles.proposalDiffHeader}>
            <span>Field</span>
            <span>Current value</span>
            <span>Proposed value</span>
          </div>
          {rows.map(row => (
            <div className={styles.proposalDiffRow} key={row.field}>
              <strong className={styles.proposalField}>{row.field}</strong>
              <span className={styles.proposalBefore}>{formatChangeApprovalValue(row.before)}</span>
              <span className={styles.proposalAfter}>{formatChangeApprovalValue(row.after)}</span>
            </div>
          ))}
        </div>
      </section>
      <Dialog
        open={bypassDialogOpen}
        onClose={() => setBypassDialogOpen(false)}
        title="Bypass approval?"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setBypassDialogOpen(false) },
          {
            label: bypass.isPending ? 'Applying…' : 'Bypass approval',
            type: 'danger',
            disabled: bypass.isPending || bypassReason.trim() === '',
            onClick: executeBypass
          }
        ]}
      >
        <p>
          This applies the proposed changes immediately and closes the approval case. Enter a reason
          for the audited override.
        </p>
        <FormElement label="Reason" required>
          <TextInput
            value={bypassReason}
            onChange={value => setBypassReason(value ?? '')}
            placeholder="Explain why approval is being bypassed"
            style={{ width: '100%' }}
          />
        </FormElement>
      </Dialog>
      <Dialog
        open={requestChangesDialogOpen}
        onClose={() => setRequestChangesDialogOpen(false)}
        title="Request changes?"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setRequestChangesDialogOpen(false) },
          {
            label: decide.isPending ? 'Submitting…' : 'Request changes',
            type: 'default',
            disabled: decide.isPending || requestChangesReason.trim() === '',
            onClick: executeRequestChanges
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
    </>
  );
};
