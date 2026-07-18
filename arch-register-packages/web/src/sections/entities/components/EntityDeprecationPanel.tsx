import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Select } from '@diagram-craft/app-components/Select';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { DeprecationCase } from '@arch-register/api-types/entityDeprecationContract';
import { useAuth } from '../../../auth/AuthContext';
import { useGovernanceTasks, useDecideGovernanceAssignment } from '../../../hooks/useGovernance';
import { useEntity } from '../../../hooks/useEntities';
import { useProjects } from '../../../hooks/useProjects';
import { EntityPicker } from '../../../components/EntityPicker';
import {
  useAcknowledgeEntityDeprecation,
  useCancelEntityDeprecation,
  useFinalizeEntityDeprecation,
  usePostponeEntityDeprecation,
  useProposeEntityDeprecation,
  useRefreshEntityDeprecationScope
} from '../../../hooks/useEntityDeprecation';
import styles from './EntityDeprecationPanel.module.css';

const teamName = (teams: WorkspaceTeam[], teamId: string) =>
  teams.find(t => t.id === teamId)?.name ?? teamId;

// ── Propose dialog ───────────────────────────────────────────────

export const ProposeEntityDeprecationDialog = ({
  open,
  onClose,
  workspaceId,
  entityId,
  baseVersion
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  entityId: string;
  baseVersion: number;
}) => {
  const propose = useProposeEntityDeprecation(workspaceId, entityId);
  const [reason, setReason] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [successorEntityId, setSuccessorEntityId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: successorEntity } = useEntity(workspaceId, successorEntityId);
  const { data: projects = [] } = useProjects(workspaceId);

  const canSubmit = reason.trim() !== '' && targetDate.trim() !== '';

  const handleSubmit = () => {
    if (!canSubmit) return;
    propose.mutate(
      {
        baseVersion,
        reason: reason.trim(),
        targetDate,
        successorEntityId: successorEntityId || undefined,
        projectId: projectId || undefined,
        notes: notes.trim() || undefined
      },
      {
        onSuccess: () => {
          setReason('');
          setTargetDate('');
          setSuccessorEntityId('');
          setProjectId('');
          setNotes('');
          onClose();
        }
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Propose deprecation"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: propose.isPending ? 'Submitting…' : 'Submit proposal',
          type: 'default',
          disabled: !canSubmit || propose.isPending,
          onClick: handleSubmit
        }
      ]}
    >
      <div className={styles.form}>
        <FormElement label="Reason" required>
          <TextInput
            value={reason}
            onChange={v => setReason(v ?? '')}
            placeholder="Why is this entity being deprecated?"
            style={{ width: '100%' }}
          />
        </FormElement>
        <FormElement label="Target deprecation date" required>
          <DateInput value={targetDate} onChange={v => setTargetDate(v ?? '')} />
        </FormElement>
        <FormElement label="Successor entity" required={false} hint="Replacement entity">
          <EntityPicker
            selectedEntityId={successorEntityId}
            selectedEntity={successorEntity}
            onSelectEntity={entity => setSuccessorEntityId(entity._publicId)}
            onClearEntity={() => setSuccessorEntityId('')}
          />
        </FormElement>
        <FormElement label="Related project" required={false}>
          <Select.Root value={projectId} placeholder="None" onChange={v => setProjectId(v ?? '')}>
            <Select.Item value="">None</Select.Item>
            {projects.map(p => (
              <Select.Item key={p.public_id} value={p.public_id}>
                {p.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
        <FormElement label="Notes for dependent owners" required={false}>
          <TextInput value={notes} onChange={v => setNotes(v ?? '')} style={{ width: '100%' }} />
        </FormElement>
      </div>
    </Dialog>
  );
};

// ── Main panel ───────────────────────────────────────────────────

type Props = {
  deprecation: DeprecationCase;
  workspaceId: string;
  entityId: string;
  teams: WorkspaceTeam[];
};

export const EntityDeprecationPanel = ({ deprecation, workspaceId, entityId, teams }: Props) => {
  const { user } = useAuth();
  const decide = useDecideGovernanceAssignment(workspaceId);
  const acknowledge = useAcknowledgeEntityDeprecation(workspaceId, entityId);
  const refreshScope = useRefreshEntityDeprecationScope(workspaceId, entityId);
  const postpone = usePostponeEntityDeprecation(workspaceId, entityId);
  const finalize = useFinalizeEntityDeprecation(workspaceId, entityId);
  const cancel = useCancelEntityDeprecation(workspaceId, entityId);

  const { data: approveTasks = [] } = useGovernanceTasks(workspaceId, {
    caseKind: 'entity.deprecation',
    taskKind: 'approve',
    state: 'open'
  });
  const { data: ackTasks = [] } = useGovernanceTasks(workspaceId, {
    caseKind: 'entity.deprecation',
    taskKind: 'acknowledge',
    state: 'open'
  });
  const approvalTask = approveTasks.find(
    task =>
      task.case.id === deprecation.id &&
      task.requiresAction &&
      (task.case.initiatorUserId !== user?.id || task.case.selfApprovalAllowed)
  );
  const myAckTask = ackTasks.find(task => task.case.id === deprecation.id && task.requiresAction);

  const [ackDialogOpen, setAckDialogOpen] = useState(false);
  const [ackComment, setAckComment] = useState('');
  const [ackRemediation, setAckRemediation] = useState('');
  const [ackRiskAccepted, setAckRiskAccepted] = useState(false);

  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [postponeDate, setPostponeDate] = useState(deprecation.targetDate);
  const [postponeReason, setPostponeReason] = useState('');

  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalizeReason, setFinalizeReason] = useState('');
  const [finalizeOverride, setFinalizeOverride] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const impactByTeam = new Map<string, typeof deprecation.baselineImpact>();
  for (const entry of [...deprecation.baselineImpact, ...(deprecation.currentImpact ?? [])]) {
    if (!entry.ownerTeamId) continue;
    if (!impactByTeam.has(entry.ownerTeamId)) impactByTeam.set(entry.ownerTeamId, []);
    const list = impactByTeam.get(entry.ownerTeamId)!;
    if (!list.some(e => e.entityId === entry.entityId)) list.push(entry);
  }
  const unownedImpact = deprecation.baselineImpact.filter(entry => !entry.ownerTeamId);

  const approve = (decision: 'approve' | 'reject' | 'request_changes') => {
    if (!approvalTask) return;
    decide.mutate({ assignmentId: approvalTask.assignment.id, decision });
  };

  const submitAck = () => {
    acknowledge.mutate(
      {
        caseId: deprecation.id,
        idempotencyKey: crypto.randomUUID(),
        comment: ackComment.trim() || undefined,
        plannedRemediation: ackRemediation.trim() || undefined,
        riskAccepted: ackRiskAccepted
      },
      {
        onSuccess: () => {
          setAckDialogOpen(false);
          setAckComment('');
          setAckRemediation('');
          setAckRiskAccepted(false);
        }
      }
    );
  };

  const submitPostpone = () => {
    if (!postponeDate.trim() || !postponeReason.trim()) return;
    postpone.mutate(
      { caseId: deprecation.id, targetDate: postponeDate, reason: postponeReason.trim() },
      { onSuccess: () => setPostponeDialogOpen(false) }
    );
  };

  const submitFinalize = () => {
    finalize.mutate(
      {
        caseId: deprecation.id,
        reason: finalizeReason.trim() || undefined,
        override: finalizeOverride || undefined
      },
      { onSuccess: () => setFinalizeDialogOpen(false) }
    );
  };

  const submitCancel = () => {
    if (!cancelReason.trim()) return;
    cancel.mutate(
      { caseId: deprecation.id, reason: cancelReason.trim() },
      { onSuccess: () => setCancelDialogOpen(false) }
    );
  };

  const outstandingAckCount = deprecation.acks.filter(ack => ack.status === 'open').length;

  return (
    <section className={styles.panel} aria-labelledby="entity-deprecation-title">
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Entity deprecation</div>
          <h2 id="entity-deprecation-title" className={styles.title}>
            {deprecation.phase === 'pending_approval'
              ? 'Deprecation proposed'
              : 'Deprecation scheduled'}
          </h2>
          <div className={styles.meta}>
            Target date: {deprecation.targetDate}
            {deprecation.overdue && <span className={styles.overdueBadge}>Overdue</span>}
          </div>
        </div>
        <div className={styles.actions}>
          {approvalTask && (
            <>
              <Button
                variant="primary"
                onClick={() => approve('approve')}
                disabled={decide.isPending}
              >
                Approve
              </Button>
              <Button onClick={() => approve('request_changes')} disabled={decide.isPending}>
                Request changes
              </Button>
              <Button
                variant="danger"
                onClick={() => approve('reject')}
                disabled={decide.isPending}
              >
                Reject
              </Button>
            </>
          )}
          {myAckTask && deprecation.phase === 'scheduled' && (
            <Button variant="primary" onClick={() => setAckDialogOpen(true)}>
              Acknowledge
            </Button>
          )}
          {deprecation.phase === 'scheduled' && (
            <>
              <Button
                onClick={() => refreshScope.mutate(deprecation.id)}
                disabled={refreshScope.isPending}
              >
                Refresh scope
              </Button>
              <Button onClick={() => setPostponeDialogOpen(true)}>Postpone</Button>
              <Button variant="primary" onClick={() => setFinalizeDialogOpen(true)}>
                Finalize
              </Button>
            </>
          )}
          <Button variant="danger" onClick={() => setCancelDialogOpen(true)}>
            Cancel
          </Button>
        </div>
      </div>

      <p className={styles.reason}>{deprecation.reason}</p>

      {(impactByTeam.size > 0 || unownedImpact.length > 0) && (
        <div className={styles.impact}>
          <div className={styles.impactHeader}>Affected owner teams</div>
          {[...impactByTeam.entries()].map(([teamId, entries]) => {
            const ack = deprecation.acks.find(a => a.ownerTeamId === teamId);
            return (
              <div className={styles.impactRow} key={teamId}>
                <strong>{teamName(teams, teamId)}</strong>
                <span className={styles.impactEntities}>
                  {entries.map(e => e.entityName).join(', ')}
                </span>
                <span
                  className={
                    ack?.status === 'completed' ? styles.ackCompleted : styles.ackOutstanding
                  }
                >
                  {ack?.status === 'completed' ? 'Acknowledged' : 'Awaiting acknowledgement'}
                </span>
              </div>
            );
          })}
          {unownedImpact.length > 0 && (
            <div className={styles.impactRow}>
              <strong>No owner team</strong>
              <span className={styles.impactEntities}>
                {unownedImpact.map(e => e.entityName).join(', ')}
              </span>
              <span className={styles.ackOutstanding}>Surfaced to workspace governance</span>
            </div>
          )}
        </div>
      )}

      {outstandingAckCount > 0 && (
        <p className={styles.hint}>
          {outstandingAckCount} team acknowledgement{outstandingAckCount === 1 ? '' : 's'}{' '}
          outstanding.
        </p>
      )}

      <Dialog
        open={ackDialogOpen}
        onClose={() => setAckDialogOpen(false)}
        title="Acknowledge deprecation impact"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setAckDialogOpen(false) },
          {
            label: acknowledge.isPending ? 'Submitting…' : 'Acknowledge',
            type: 'default',
            disabled: acknowledge.isPending,
            onClick: submitAck
          }
        ]}
      >
        <div className={styles.form}>
          <FormElement label="Comment" required={false}>
            <TextInput
              value={ackComment}
              onChange={v => setAckComment(v ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Planned remediation" required={false}>
            <TextInput
              value={ackRemediation}
              onChange={v => setAckRemediation(v ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>
          <Checkbox
            value={ackRiskAccepted}
            onChange={v => setAckRiskAccepted(v ?? false)}
            label="We accept the risk of this deprecation without remediation"
          />
        </div>
      </Dialog>

      <Dialog
        open={postponeDialogOpen}
        onClose={() => setPostponeDialogOpen(false)}
        title="Postpone deprecation"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setPostponeDialogOpen(false) },
          {
            label: postpone.isPending ? 'Saving…' : 'Postpone',
            type: 'default',
            disabled: postpone.isPending || !postponeDate.trim() || !postponeReason.trim(),
            onClick: submitPostpone
          }
        ]}
      >
        <div className={styles.form}>
          <FormElement label="New target date" required>
            <DateInput value={postponeDate} onChange={v => setPostponeDate(v ?? '')} />
          </FormElement>
          <FormElement label="Reason" required>
            <TextInput
              value={postponeReason}
              onChange={v => setPostponeReason(v ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>
        </div>
      </Dialog>

      <Dialog
        open={finalizeDialogOpen}
        onClose={() => setFinalizeDialogOpen(false)}
        title="Finalize deprecation"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setFinalizeDialogOpen(false) },
          {
            label: finalize.isPending ? 'Finalizing…' : 'Finalize',
            type: 'danger',
            disabled: finalize.isPending,
            onClick: submitFinalize
          }
        ]}
      >
        <div className={styles.form}>
          {outstandingAckCount > 0 && (
            <p className={styles.hint}>
              {outstandingAckCount} acknowledgement{outstandingAckCount === 1 ? '' : 's'} still
              outstanding. A reason is required to finalize anyway.
            </p>
          )}
          <FormElement
            label="Reason"
            required={outstandingAckCount > 0 || finalizeOverride}
            hint="Required if outstanding acknowledgements or finalizing early"
          >
            <TextInput
              value={finalizeReason}
              onChange={v => setFinalizeReason(v ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>
          <Checkbox
            value={finalizeOverride}
            onChange={v => setFinalizeOverride(v ?? false)}
            label="Override: finalize before the target date"
          />
        </div>
      </Dialog>

      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="Cancel deprecation"
        buttons={[
          { label: 'Back', type: 'cancel', onClick: () => setCancelDialogOpen(false) },
          {
            label: cancel.isPending ? 'Cancelling…' : 'Cancel deprecation',
            type: 'danger',
            disabled: cancel.isPending || !cancelReason.trim(),
            onClick: submitCancel
          }
        ]}
      >
        <div className={styles.form}>
          <FormElement label="Reason" required>
            <TextInput
              value={cancelReason}
              onChange={v => setCancelReason(v ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>
        </div>
      </Dialog>
    </section>
  );
};
