import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { TbArrowBackUp, TbBell, TbSend } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  GovernanceAssignment,
  GovernanceSubmission
} from '@arch-register/api-types/governanceContract';
import { EmptyState } from '../../components/EmptyState';
import {
  useSendGovernanceCaseReminder,
  useWithdrawGovernanceCase
} from '../../hooks/useGovernance';
import { useWithdrawEntityChangeApproval } from '../../hooks/useEntityChanges';
import { governanceCaseEventsQuery } from '../../queries/governance';
import { ENTITY_CHANGE_CASE_KIND, isEntityChangeCaseKind } from '../../utils/governanceCaseKinds';
import { caseKindLabel, humanizeCaseKind as humanize } from '../../utils/governanceCaseLabels';
import { formatDateTime } from '../../utils/dateFormat';
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

export type SubmissionStatusFilter = 'open' | 'completed' | 'cancelled';

/**
 * Narrows submissions to the selected status. 'open' ("Needs attention") also includes
 * completed-but-request_changes cases, since the requester still has to act on those, so the
 * server query for it is unfiltered and the narrowing happens here.
 */
export const filterSubmissions = (
  submissions: GovernanceSubmission[],
  status: SubmissionStatusFilter,
  isProposalWithdrawn: (kase: GovernanceSubmission['case']) => boolean
) =>
  submissions.filter(submission => {
    if (isProposalWithdrawn(submission.case)) return status === 'cancelled';
    const needsAttention =
      submission.case.status === 'open' || submission.case.outcome === 'request_changes';
    if (status === 'open') return needsAttention;
    if (status === 'completed') {
      return (
        submission.case.status === 'completed' && submission.case.outcome !== 'request_changes'
      );
    }
    return true;
  });

const describeWaitingOn = (assignment: GovernanceAssignment) => {
  const action = humanize(assignment.action);
  if (assignment.targetType === 'user') return `Awaiting ${action.toLowerCase()}`;
  if (assignment.targetType === 'team') return `Awaiting ${action.toLowerCase()} by your team`;
  if (assignment.targetType === 'team_role') {
    return `Awaiting ${action.toLowerCase()} by role: ${assignment.targetTeamRole ?? 'unknown'}`;
  }
  return `Awaiting ${action.toLowerCase()} by: ${assignment.targetCapability ?? 'unknown'}`;
};

export const GovernanceSubmissionList = ({
  workspace,
  submissions,
  isLoading,
  subjects
}: {
  workspace: string;
  submissions: GovernanceSubmission[];
  isLoading: boolean;
  subjects: ReturnType<typeof useCaseSubjects>;
}) => {
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const caseRowClick = useCaseRowClick();
  const withdrawCase = useWithdrawGovernanceCase(workspace);
  const withdrawEntityChangeApproval = useWithdrawEntityChangeApproval(workspace);
  const sendReminder = useSendGovernanceCaseReminder(workspace);
  const [reminderErrorByCaseId, setReminderErrorByCaseId] = useState<Record<string, string>>({});

  const requestChangesCaseIds = [
    ...new Set(
      submissions
        .filter(submission => submission.case.outcome === 'request_changes')
        .map(submission => submission.case.id)
    )
  ];
  const caseEventsQueries = useQueries({
    queries: requestChangesCaseIds.map(caseId =>
      governanceCaseEventsQuery(workspace, caseId, !!workspace)
    )
  });
  const requestChangesReasonByCaseId = new Map(
    requestChangesCaseIds.map((caseId, index) => [
      caseId,
      [...(caseEventsQueries[index]?.data ?? [])]
        .reverse()
        .find(caseEvent => caseEvent.eventType === 'changes_requested')?.reason
    ])
  );

  const withdrawSubmission = (submission: GovernanceSubmission) => {
    if (
      submission.case.caseKind === ENTITY_CHANGE_CASE_KIND &&
      submission.case.subjectType === 'entity'
    ) {
      const proposal = subjects.resolve(submission.case).proposal;
      if (proposal) {
        withdrawEntityChangeApproval.mutate({
          entityId: submission.case.subjectId,
          approvalId: proposal.id
        });
      }
      return;
    }
    withdrawCase.mutate({ caseId: submission.case.id });
  };

  const sendCaseReminder = (caseId: string) => {
    setReminderErrorByCaseId(prev => {
      const next = { ...prev };
      delete next[caseId];
      return next;
    });
    sendReminder.mutate(
      { caseId },
      {
        onError: mutationError => {
          setReminderErrorByCaseId(prev => ({
            ...prev,
            [caseId]:
              mutationError instanceof Error ? mutationError.message : 'Could not send reminder'
          }));
        }
      }
    );
  };

  if (submissions.length === 0 && !isLoading) {
    return (
      <EmptyState
        framed
        icon={<TbSend size={18} />}
        title="No requests found"
        subtitle="Governance work you request will appear here."
      />
    );
  }

  return (
    <ul className={styles.list} aria-label="Requested governance cases">
      {submissions.map(submission => {
        const subject = subjects.resolve(submission.case);
        const proposalWithdrawn = subjects.isProposalWithdrawn(submission.case);
        const withdrawPending =
          submission.case.caseKind === ENTITY_CHANGE_CASE_KIND
            ? withdrawEntityChangeApproval.isPending
            : withdrawCase.isPending;
        const requestChangesReason = requestChangesReasonByCaseId.get(submission.case.id);
        // A case being cancelled requires it to still be open (`cancelGovernanceCase`), but an
        // entity-change proposal can be withdrawn independent of case status — its own status
        // stays 'open' until the proposer explicitly withdraws or a decision is approved/rejected,
        // so a 'changes_requested' case (which is otherwise 'completed') is still withdrawable
        // through that path.
        const canWithdraw =
          !proposalWithdrawn &&
          (submission.case.status === 'open' ||
            (isEntityChangeCaseKind(submission.case.caseKind) &&
              submission.case.outcome === 'request_changes'));
        const canRemind =
          submission.case.status === 'open' && submission.openAssignments.length > 0;
        const reminderError = reminderErrorByCaseId[submission.case.id];
        return (
          <li
            className={styles.task}
            key={submission.case.id}
            onClick={caseRowClick(submission.case.id)}
          >
            <div className={styles.taskMain}>
              <div className={styles.taskTitle}>
                {subject.isBulk
                  ? `${subject.label} · ${caseKindLabel(submission.case.caseKind, submission.case.payload)}`
                  : caseKindLabel(submission.case.caseKind, submission.case.payload)}
              </div>
              <div className={styles.taskMeta}>
                <span>{subject.isBulk ? 'Entities' : humanize(submission.case.subjectType)}</span>
                <span>·</span>
                <span>{subject.label}</span>
                <span>·</span>
                <span>
                  Requested{' '}
                  {formatDateTime(submission.case.createdAt, '—', dateTimeFormatPreference)}
                </span>
              </div>
              <BulkMemberLinks subject={subject} />
              <div className={styles.taskProposalMeta}>
                {proposalWithdrawn
                  ? 'Status: Withdrawn'
                  : submission.case.status === 'open'
                    ? submission.openAssignments.length > 0
                      ? submission.openAssignments.map(describeWaitingOn).join(' · ')
                      : 'Awaiting review'
                    : `Status: ${humanize(submission.case.status)}${
                        submission.case.outcome ? ` (${humanize(submission.case.outcome)})` : ''
                      }`}
              </div>
              {subject.note && (
                <div className={styles.taskNote} title={subject.note}>
                  <span className={styles.taskNoteLabel}>Your note</span>
                  <span>{previewNote(subject.note)}</span>
                </div>
              )}
              <InitiationFieldSummary fields={submission.case.initiationFields} />
              {requestChangesReason && (
                <div className={styles.taskNote} title={requestChangesReason}>
                  <span className={styles.taskNoteLabel}>Reviewer requested changes</span>
                  <span>{previewNote(requestChangesReason)}</span>
                </div>
              )}
              {reminderError && (
                <div className={styles.taskNote} title={reminderError}>
                  <span className={styles.taskNoteLabel}>Reminder</span>
                  <span>{previewNote(reminderError)}</span>
                </div>
              )}
            </div>
            <div className={styles.taskAction}>
              {canRemind && (
                <Button
                  variant="secondary"
                  icon={<TbBell size={12} />}
                  disabled={sendReminder.isPending}
                  onClick={event => {
                    event.stopPropagation();
                    sendCaseReminder(submission.case.id);
                  }}
                >
                  Send reminder
                </Button>
              )}
              {canWithdraw && (
                <Button
                  variant="secondary"
                  icon={<TbArrowBackUp size={12} />}
                  disabled={withdrawPending}
                  onClick={event => {
                    event.stopPropagation();
                    withdrawSubmission(submission);
                  }}
                >
                  Withdraw
                </Button>
              )}
              <ViewSubjectButton workspace={workspace} kase={submission.case} />
            </div>
          </li>
        );
      })}
    </ul>
  );
};
