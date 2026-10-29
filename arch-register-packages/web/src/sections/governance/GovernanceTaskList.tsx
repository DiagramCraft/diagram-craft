import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TbAlertTriangle, TbCheck, TbClock, TbInbox, TbMessageReply } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { GovernanceTask } from '@arch-register/api-types/governanceContract';
import { EmptyState } from '../../components/EmptyState';
import { useDecideGovernanceAssignment } from '../../hooks/useGovernance';
import {
  invalidateBulkEntityChangeQueries,
  invalidateEntityChangeQueries
} from '../../queries/entityChanges';
import {
  ENTITY_CHANGE_BULK_CASE_KIND,
  REQUEST_CHANGES_CASE_KINDS
} from '../../utils/governanceCaseKinds';
import { caseKindLabel, humanizeCaseKind as humanize } from '../../utils/governanceCaseLabels';
import { formatDate, formatDateTime } from '../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../hooks/useDateTimeFormatPreference';
import {
  BulkMemberLinks,
  InitiationFieldSummary,
  ViewSubjectButton,
  previewNote,
  useCaseRowClick
} from './GovernanceCaseRowParts';
import type { useCaseSubjects } from './useCaseSubjects';
import styles from './GovernanceInboxScreen.module.css';

export const GovernanceTaskList = ({
  workspace,
  tasks,
  isLoading,
  state,
  subjects
}: {
  workspace: string;
  tasks: GovernanceTask[];
  isLoading: boolean;
  state: 'open' | 'completed';
  subjects: ReturnType<typeof useCaseSubjects>;
}) => {
  const queryClient = useQueryClient();
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const caseRowClick = useCaseRowClick();
  const decide = useDecideGovernanceAssignment(workspace);
  const [requestChangesTask, setRequestChangesTask] = useState<GovernanceTask | null>(null);
  const [requestChangesReason, setRequestChangesReason] = useState('');

  const submitRequestChanges = () => {
    if (!requestChangesTask) return;
    const reason = requestChangesReason.trim();
    if (reason === '') return;
    decide.mutate(
      { assignmentId: requestChangesTask.assignment.id, decision: 'request_changes', reason },
      {
        onSuccess: async () => {
          if (requestChangesTask.case.caseKind === ENTITY_CHANGE_BULK_CASE_KIND) {
            await invalidateBulkEntityChangeQueries(
              queryClient,
              workspace,
              requestChangesTask.case.subjectId
            );
          } else {
            await invalidateEntityChangeQueries(
              queryClient,
              workspace,
              requestChangesTask.case.subjectId
            );
          }
          setRequestChangesTask(null);
          setRequestChangesReason('');
        }
      }
    );
  };

  if (tasks.length === 0 && !isLoading) {
    return (
      <EmptyState
        framed
        icon={<TbInbox size={18} />}
        title={`No ${state === 'open' ? 'open tasks' : 'completed tasks'} found`}
        subtitle="Governance work assigned to you will appear here."
      />
    );
  }

  return (
    <>
      <ul className={styles.list} aria-label="Governance tasks">
        {tasks.map(task => {
          const subject = subjects.resolve(task.case);
          const decision =
            task.assignment.action === 'approve'
              ? 'approve'
              : task.assignment.action === 'acknowledge'
                ? 'acknowledge'
                : null;
          const canRequestChanges =
            task.requiresAction &&
            decision === 'approve' &&
            REQUEST_CHANGES_CASE_KINDS.has(task.case.caseKind);
          return (
            <li
              className={styles.task}
              key={task.assignment.id}
              onClick={caseRowClick(task.case.id)}
            >
              <div className={styles.taskMain}>
                <div className={styles.taskTitle}>
                  {subject.isBulk
                    ? `${subject.label} · ${caseKindLabel(task.case.caseKind, task.case.payload)}`
                    : caseKindLabel(task.case.caseKind, task.case.payload)}{' '}
                  · {humanize(task.assignment.action)}
                </div>
                <BulkMemberLinks subject={subject} />
                <div className={styles.taskMeta}>
                  <span>{humanize(task.case.subjectType)}</span>
                  <span>·</span>
                  <span>{subject.label}</span>
                  {task.case.dueAt && (
                    <>
                      <span>·</span>
                      <span
                        className={`${styles.taskDue} ${
                          new Date(task.case.dueAt) < new Date() ? styles.taskDueOverdue : ''
                        }`}
                      >
                        <TbClock size={11} /> Due{' '}
                        {formatDate(task.case.dueAt, '—', dateTimeFormatPreference)}
                      </span>
                    </>
                  )}
                  {task.case.escalatedAt && (
                    <>
                      <span>·</span>
                      <span className={styles.taskEscalatedBadge}>
                        <TbAlertTriangle size={11} /> Escalated
                      </span>
                    </>
                  )}
                </div>
                {subject.latestRevision && (
                  <div className={styles.taskProposalMeta}>
                    Proposed by {subject.latestRevision.createdByName ?? 'Unknown user'} ·{' '}
                    {formatDateTime(
                      subject.latestRevision.createdAt,
                      '—',
                      dateTimeFormatPreference
                    )}
                  </div>
                )}
                {subject.note && (
                  <div className={styles.taskNote} title={subject.note}>
                    <span className={styles.taskNoteLabel}>Proposer note</span>
                    <span>{previewNote(subject.note)}</span>
                  </div>
                )}
                <InitiationFieldSummary fields={task.case.initiationFields} />
              </div>
              <div className={styles.taskAction}>
                {task.requiresAction && decision && (
                  <Button
                    variant="primary"
                    icon={<TbCheck size={12} />}
                    disabled={decide.isPending}
                    onClick={event => {
                      event.stopPropagation();
                      decide.mutate({ assignmentId: task.assignment.id, decision });
                    }}
                  >
                    {decision === 'approve' ? 'Approve' : 'Acknowledge'}
                  </Button>
                )}
                {canRequestChanges && (
                  <Button
                    icon={<TbMessageReply size={12} />}
                    disabled={decide.isPending}
                    onClick={event => {
                      event.stopPropagation();
                      setRequestChangesTask(task);
                      setRequestChangesReason('');
                    }}
                  >
                    Request changes
                  </Button>
                )}
                <ViewSubjectButton workspace={workspace} kase={task.case} />
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog
        open={requestChangesTask != null}
        onClose={() => setRequestChangesTask(null)}
        title="Request changes?"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setRequestChangesTask(null) },
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
    </>
  );
};
