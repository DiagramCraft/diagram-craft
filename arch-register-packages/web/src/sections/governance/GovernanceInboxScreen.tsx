import { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { TbAlertTriangle, TbClipboardCheck, TbClock, TbExternalLink } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Title } from '../../components/Title';
import {
  useDecideGovernanceAssignment,
  useGovernanceSubmissions,
  useGovernanceTasks,
  useSendGovernanceCaseReminder,
  useWithdrawGovernanceCase
} from '../../hooks/useGovernance';
import type {
  GovernanceAssignment,
  GovernanceSubmission,
  GovernanceTask
} from '@arch-register/api-types/governanceContract';
import styles from './GovernanceInboxScreen.module.css';
import { entityDetailRoute, asEntityPublicId } from '../../routes/publicObjectRoutes';
import { workspaceMarkdownRoute } from '../../routes/publicObjectRoutes';
import { projectDetailRoute, asProjectPublicId } from '../../routes/publicObjectRoutes';
import { entityDetailQuery } from '../../queries/entities';
import { governanceCaseEventsQuery } from '../../queries/governance';
import { contentFileQuery } from '../../queries/content';
import {
  bulkEntityChangeQuery,
  entityChangeQuery,
  invalidateBulkEntityChangeQueries,
  invalidateEntityChangeQueries
} from '../../queries/entityChanges';
import { useWithdrawEntityChangeApproval } from '../../hooks/useEntityChanges';

const humanize = (value: string) =>
  value.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

const InitiationFieldSummary = ({
  fields
}: {
  fields: Array<{ id: string; label: string; value: unknown }>;
}) => {
  const populated = fields.filter(field => field.value != null && field.value !== '');
  if (populated.length === 0) return null;
  return (
    <div className={styles.taskNote}>
      {populated.map(field => (
        <div key={field.id}>
          <span className={styles.taskNoteLabel}>{field.label}</span>{' '}
          {Array.isArray(field.value) ? field.value.join(', ') : String(field.value)}
        </div>
      ))}
    </div>
  );
};

const caseKindLabel = (caseKind: string, payload: Record<string, unknown>) => {
  if (caseKind === 'field-date-reminder') {
    const fieldName = payload['fieldName'];
    return typeof fieldName === 'string' ? `Date reminder · ${fieldName}` : 'Date reminder';
  }
  return humanize(caseKind);
};

const previewNote = (note: string) => (note.length > 180 ? `${note.slice(0, 177)}…` : note);

const describeWaitingOn = (assignment: GovernanceAssignment) => {
  const action = humanize(assignment.action);
  if (assignment.targetType === 'user') return `Awaiting ${action.toLowerCase()}`;
  if (assignment.targetType === 'team') return `Awaiting ${action.toLowerCase()} by your team`;
  if (assignment.targetType === 'team_role') {
    return `Awaiting ${action.toLowerCase()} by role: ${assignment.targetTeamRole ?? 'unknown'}`;
  }
  return `Awaiting ${action.toLowerCase()} by: ${assignment.targetCapability ?? 'unknown'}`;
};

export const GovernanceInboxScreen = () => {
  const { workspaceSlug } = useParams({ strict: false });
  const navigate = useNavigate();
  const workspace = workspaceSlug ?? '';
  const [scope, setScope] = useState<'assigned' | 'submitted'>('assigned');
  const [state, setState] = useState<'open' | 'completed'>('open');
  const [taskKind, setTaskKind] = useState('');
  const [caseKind, setCaseKind] = useState('');
  const [due, setDue] = useState<'all' | 'overdue' | 'week'>('all');
  const [submittedStatus, setSubmittedStatus] = useState<'open' | 'completed' | 'cancelled'>(
    'open'
  );
  const now = new Date();
  const dueBefore =
    due === 'overdue'
      ? now.toISOString()
      : due === 'week'
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    error: tasksError
  } = useGovernanceTasks(
    workspace,
    {
      state,
      ...(caseKind ? { caseKind } : {}),
      ...(taskKind
        ? { taskKind: taskKind as 'approve' | 'acknowledge' | 'review' | 'remediate' }
        : {}),
      ...(dueBefore ? { dueBefore } : {})
    },
    !!workspace && scope === 'assigned'
  );
  const {
    data: rawSubmissions = [],
    isLoading: submissionsLoading,
    error: submissionsError
  } = useGovernanceSubmissions(
    workspace,
    {
      // 'open' also needs to surface completed-but-request_changes cases (the proposer still
      // has to act on those), so it fetches unfiltered and narrows client-side below instead of
      // asking the server for status: 'open' directly.
      ...(submittedStatus === 'open' ? {} : { status: submittedStatus }),
      ...(caseKind ? { caseKind } : {})
    },
    !!workspace && scope === 'submitted'
  );
  const queryClient = useQueryClient();
  const decide = useDecideGovernanceAssignment(workspace);
  const withdrawCase = useWithdrawGovernanceCase(workspace);
  const sendReminder = useSendGovernanceCaseReminder(workspace);
  const [reminderErrorByCaseId, setReminderErrorByCaseId] = useState<Record<string, string>>({});
  const [requestChangesTask, setRequestChangesTask] = useState<GovernanceTask | null>(null);
  const [requestChangesReason, setRequestChangesReason] = useState('');
  const isLoading = scope === 'assigned' ? tasksLoading : submissionsLoading;
  const error = scope === 'assigned' ? tasksError : submissionsError;
  const bulkCaseIds = [
    ...new Set([
      ...tasks
        .filter(task => task.case.caseKind === 'entity.change.bulk')
        .map(task => task.case.subjectId),
      ...rawSubmissions
        .filter(submission => submission.case.caseKind === 'entity.change.bulk')
        .map(submission => submission.case.subjectId)
    ])
  ];
  const bulkProposalQueries = useQueries({
    queries: bulkCaseIds.map(caseId => bulkEntityChangeQuery(workspace, caseId))
  });
  const bulkProposalsByCaseId = new Map(
    bulkCaseIds.map((caseId, index) => [caseId, bulkProposalQueries[index]?.data])
  );
  const entityIds = [
    ...new Set([
      ...tasks.filter(task => task.case.subjectType === 'entity').map(task => task.case.subjectId),
      ...rawSubmissions
        .filter(submission => submission.case.subjectType === 'entity')
        .map(submission => submission.case.subjectId),
      ...[...bulkProposalsByCaseId.values()].flatMap(proposal => proposal?.entityIds ?? [])
    ])
  ];
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => entityDetailQuery(workspace, entityId))
  });
  const entitiesById = new Map(
    entityIds.map((entityId, index) => [entityId, entityQueries[index]?.data])
  );
  const documentIds = [
    ...new Set([
      ...tasks
        .filter(task => task.case.subjectType === 'document')
        .map(task => task.case.subjectId),
      ...rawSubmissions
        .filter(submission => submission.case.subjectType === 'document')
        .map(submission => submission.case.subjectId)
    ])
  ];
  const documentQueries = useQueries({
    queries: documentIds.map(fileId => contentFileQuery(workspace, fileId))
  });
  const documentsById = new Map(
    documentIds.map((fileId, index) => [fileId, documentQueries[index]?.data])
  );
  const entityChangeIds = [
    ...new Set([
      ...tasks
        .filter(
          task => task.case.caseKind === 'entity.change' && task.case.subjectType === 'entity'
        )
        .map(task => task.case.subjectId),
      ...rawSubmissions
        .filter(
          submission =>
            submission.case.caseKind === 'entity.change' && submission.case.subjectType === 'entity'
        )
        .map(submission => submission.case.subjectId)
    ])
  ];
  const proposalQueries = useQueries({
    queries: entityChangeIds.map(entityId => entityChangeQuery(workspace, entityId))
  });
  const proposalsByEntityId = new Map(
    entityChangeIds.map((entityId, index) => [entityId, proposalQueries[index]?.data])
  );
  const withdrawEntityChangeApproval = useWithdrawEntityChangeApproval(workspace);
  // Withdrawing an entity-change proposal whose case had already completed (e.g. after a
  // 'request_changes' decision) updates the proposal, not the case — `cancelCaseIfOpen` is a
  // no-op on a case that's no longer open, so `submission.case.status`/`outcome` alone can't
  // tell a withdrawn proposal apart from one still awaiting revision. Fall back to the
  // proposal's own status for entity-change cases.
  const isEntityChangeProposalWithdrawn = (submission: GovernanceSubmission) =>
    submission.case.caseKind === 'entity.change' &&
    proposalsByEntityId.get(submission.case.subjectId)?.status === 'withdrawn';
  const submissions = rawSubmissions.filter(submission => {
    if (isEntityChangeProposalWithdrawn(submission)) return submittedStatus === 'cancelled';
    const needsAttention =
      submission.case.status === 'open' || submission.case.outcome === 'request_changes';
    if (submittedStatus === 'open') return needsAttention;
    if (submittedStatus === 'completed') {
      return (
        submission.case.status === 'completed' && submission.case.outcome !== 'request_changes'
      );
    }
    return true;
  });

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
    if (submission.case.caseKind === 'entity.change' && submission.case.subjectType === 'entity') {
      const proposal = proposalsByEntityId.get(submission.case.subjectId);
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

  const submitRequestChanges = () => {
    if (!requestChangesTask) return;
    const reason = requestChangesReason.trim();
    if (reason === '') return;
    decide.mutate(
      { assignmentId: requestChangesTask.assignment.id, decision: 'request_changes', reason },
      {
        onSuccess: async () => {
          if (requestChangesTask.case.caseKind === 'entity.change.bulk') {
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

  return (
    <div className={styles.screen}>
      <Title
        eyebrow="Governance"
        title="My work"
        description="Governance tasks assigned to you or available through your workspace roles."
        buttons={<TbClipboardCheck size={20} />}
      />

      <Tabs.Root value={scope} onValueChange={value => setScope(value as 'assigned' | 'submitted')}>
        <Tabs.List>
          <Tabs.Trigger value="assigned">Assigned to me</Tabs.Trigger>
          <Tabs.Trigger value="submitted">Submitted by me</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <div className={styles.toolbar}>
        {scope === 'assigned' ? (
          <>
            <select
              className={styles.select}
              aria-label="Task state"
              value={state}
              onChange={event => setState(event.target.value as 'open' | 'completed')}
            >
              <option value="open">Open tasks</option>
              <option value="completed">Completed history</option>
            </select>
            <select
              className={styles.select}
              aria-label="Task kind"
              value={taskKind}
              onChange={event => setTaskKind(event.target.value)}
            >
              <option value="">All task kinds</option>
              <option value="approve">Approve</option>
              <option value="acknowledge">Acknowledge</option>
              <option value="review">Review</option>
              <option value="remediate">Remediate</option>
            </select>
          </>
        ) : (
          <select
            className={styles.select}
            aria-label="Submission status"
            value={submittedStatus}
            onChange={event =>
              setSubmittedStatus(event.target.value as 'open' | 'completed' | 'cancelled')
            }
          >
            <option value="open">Needs attention</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Withdrawn / cancelled</option>
          </select>
        )}
        <input
          className={styles.input}
          aria-label="Case kind"
          placeholder="Filter case kind"
          value={caseKind}
          onChange={event => setCaseKind(event.target.value)}
        />
        {scope === 'assigned' && (
          <select
            className={styles.select}
            aria-label="Due date"
            value={due}
            onChange={event => setDue(event.target.value as 'all' | 'overdue' | 'week')}
          >
            <option value="all">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="week">Due in 7 days</option>
          </select>
        )}
      </div>

      <div className={styles.summary}>
        {isLoading
          ? 'Loading…'
          : scope === 'assigned'
            ? `${tasks.length} ${state === 'open' ? 'open task' : 'completed task'}${tasks.length === 1 ? '' : 's'}`
            : `${submissions.length} submission${submissions.length === 1 ? '' : 's'}`}
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          My work could not be loaded. Your access may have changed; reload to try again.
        </div>
      ) : scope === 'submitted' ? (
        submissions.length === 0 && !isLoading ? (
          <div className={styles.empty}>
            <div>No submissions found.</div>
            <div>Governance work you submit will appear here.</div>
          </div>
        ) : (
          <ul className={styles.list} aria-label="Submitted governance cases">
            {submissions.map((submission: GovernanceSubmission) => {
              const isBulk = submission.case.caseKind === 'entity.change.bulk';
              const bulkProposal = isBulk
                ? bulkProposalsByCaseId.get(submission.case.subjectId)
                : undefined;
              const bulkMemberEntities = (bulkProposal?.entityIds ?? [])
                .map(entityId => entitiesById.get(entityId))
                .filter(
                  (memberEntity): memberEntity is NonNullable<typeof memberEntity> =>
                    memberEntity != null
                );
              const subjectEntity =
                submission.case.subjectType === 'entity'
                  ? entitiesById.get(submission.case.subjectId)
                  : undefined;
              const subjectDocument =
                submission.case.subjectType === 'document'
                  ? documentsById.get(submission.case.subjectId)
                  : undefined;
              const assessmentName =
                submission.case.subjectType === 'assessment'
                  ? (submission.case.payload['name'] as string | undefined)
                  : undefined;
              const subjectLabel = isBulk
                ? `${bulkProposal?.entityIds.length ?? 0} entities`
                : (subjectEntity?._name ??
                  subjectDocument?.name ??
                  assessmentName ??
                  submission.case.subjectId);
              const proposal = proposalsByEntityId.get(submission.case.subjectId);
              const latestRevision = isBulk
                ? bulkProposal?.revisions.at(-1)
                : proposal?.revisions.at(-1);
              const proposalNote = latestRevision?.message;
              const viewSubject = () => {
                if (subjectEntity?._publicId) {
                  navigate(entityDetailRoute(workspace, asEntityPublicId(subjectEntity._publicId)));
                } else if (submission.case.subjectType === 'document') {
                  navigate(
                    workspaceMarkdownRoute(workspace, submission.case.subjectId, {
                      mode: 'preview'
                    })
                  );
                } else if (submission.case.subjectType === 'assessment') {
                  const projectId = submission.case.payload['projectId'] as string | undefined;
                  if (projectId) {
                    navigate(
                      projectDetailRoute(workspace, asProjectPublicId(projectId), {
                        section: 'assessments',
                        assessmentId: submission.case.subjectId
                      })
                    );
                  }
                }
              };
              const withdrawPending =
                submission.case.caseKind === 'entity.change'
                  ? withdrawEntityChangeApproval.isPending
                  : withdrawCase.isPending;
              const requestChangesReason = requestChangesReasonByCaseId.get(submission.case.id);
              // A case being cancelled requires it to still be open (`cancelGovernanceCase`),
              // but an entity-change proposal can be withdrawn independent of case status —
              // its own status stays 'open' until the proposer explicitly withdraws or a
              // decision is approved/rejected, so a 'changes_requested' case (which is
              // otherwise 'completed') is still withdrawable through that path.
              const canWithdraw =
                !isEntityChangeProposalWithdrawn(submission) &&
                (submission.case.status === 'open' ||
                  ((submission.case.caseKind === 'entity.change' ||
                    submission.case.caseKind === 'entity.change.bulk') &&
                    submission.case.outcome === 'request_changes'));
              const canRemind =
                submission.case.status === 'open' && submission.openAssignments.length > 0;
              const reminderError = reminderErrorByCaseId[submission.case.id];
              return (
                <li className={styles.task} key={submission.case.id}>
                  <div className={styles.taskMain}>
                    <div className={styles.taskTitle}>
                      {isBulk
                        ? `${subjectLabel} · ${caseKindLabel(submission.case.caseKind, submission.case.payload)}`
                        : caseKindLabel(submission.case.caseKind, submission.case.payload)}
                    </div>
                    <div className={styles.taskMeta}>
                      <span>{isBulk ? 'Entities' : humanize(submission.case.subjectType)}</span>
                      <span>·</span>
                      <span>{subjectLabel}</span>
                      <span>·</span>
                      <span>Submitted {new Date(submission.case.createdAt).toLocaleString()}</span>
                    </div>
                    {isBulk && bulkMemberEntities.length > 0 && (
                      <div className={styles.taskMeta}>
                        {bulkMemberEntities.map((memberEntity, index) => (
                          <span key={memberEntity._uid}>
                            {index > 0 && <span>, </span>}
                            {memberEntity._publicId ? (
                              <a
                                href="#"
                                onClick={event => {
                                  event.preventDefault();
                                  navigate(
                                    entityDetailRoute(
                                      workspace,
                                      asEntityPublicId(memberEntity._publicId)
                                    )
                                  );
                                }}
                              >
                                {memberEntity._name}
                              </a>
                            ) : (
                              memberEntity._name
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={styles.taskProposalMeta}>
                      {isEntityChangeProposalWithdrawn(submission)
                        ? 'Status: Withdrawn'
                        : submission.case.status === 'open'
                          ? submission.openAssignments.length > 0
                            ? submission.openAssignments.map(describeWaitingOn).join(' · ')
                            : 'Awaiting review'
                          : `Status: ${humanize(submission.case.status)}${
                              submission.case.outcome
                                ? ` (${humanize(submission.case.outcome)})`
                                : ''
                            }`}
                    </div>
                    {proposalNote && (
                      <div className={styles.taskNote} title={proposalNote}>
                        <span className={styles.taskNoteLabel}>Your note</span>
                        <span>{previewNote(proposalNote)}</span>
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
                        disabled={withdrawPending}
                        onClick={event => {
                          event.stopPropagation();
                          withdrawSubmission(submission);
                        }}
                      >
                        Withdraw
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      icon={<TbExternalLink size={12} />}
                      onClick={viewSubject}
                      disabled={
                        !subjectEntity?._publicId &&
                        submission.case.subjectType !== 'document' &&
                        submission.case.subjectType !== 'assessment'
                      }
                    >
                      {submission.case.subjectType === 'entity'
                        ? 'View entity'
                        : submission.case.subjectType === 'document'
                          ? 'View document'
                          : submission.case.subjectType === 'assessment'
                            ? 'View assessment'
                            : 'View case'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : tasks.length === 0 && !isLoading ? (
        <div className={styles.empty}>
          <div>No {state === 'open' ? 'open tasks' : 'completed tasks'} found.</div>
          <div>Governance work assigned to you will appear here.</div>
        </div>
      ) : (
        <ul className={styles.list} aria-label="Governance tasks">
          {tasks.map((task: GovernanceTask) => {
            const actionLabel = humanize(task.assignment.action);
            const decision =
              task.assignment.action === 'approve'
                ? 'approve'
                : task.assignment.action === 'acknowledge'
                  ? 'acknowledge'
                  : null;
            const isBulk = task.case.caseKind === 'entity.change.bulk';
            const bulkProposal = isBulk
              ? bulkProposalsByCaseId.get(task.case.subjectId)
              : undefined;
            const bulkMemberEntities = (bulkProposal?.entityIds ?? [])
              .map(entityId => entitiesById.get(entityId))
              .filter(
                (memberEntity): memberEntity is NonNullable<typeof memberEntity> =>
                  memberEntity != null
              );
            const subjectEntity =
              task.case.subjectType === 'entity'
                ? entitiesById.get(task.case.subjectId)
                : undefined;
            const subjectDocument =
              task.case.subjectType === 'document'
                ? documentsById.get(task.case.subjectId)
                : undefined;
            const assessmentName =
              task.case.subjectType === 'assessment'
                ? (task.case.payload['name'] as string | undefined)
                : undefined;
            const subjectLabel = isBulk
              ? `${bulkProposal?.entityIds.length ?? 0} entities`
              : (subjectEntity?._name ??
                subjectDocument?.name ??
                assessmentName ??
                task.case.subjectId);
            const proposal = proposalsByEntityId.get(task.case.subjectId);
            const latestRevision = isBulk
              ? bulkProposal?.revisions.at(-1)
              : proposal?.revisions.at(-1);
            const proposalNote = latestRevision?.message;
            const viewSubject = () => {
              if (subjectEntity?._publicId) {
                navigate(entityDetailRoute(workspace, asEntityPublicId(subjectEntity._publicId)));
              } else if (task.case.subjectType === 'document') {
                navigate(
                  workspaceMarkdownRoute(workspace, task.case.subjectId, { mode: 'preview' })
                );
              } else if (task.case.subjectType === 'assessment') {
                const projectId = task.case.payload['projectId'] as string | undefined;
                if (projectId) {
                  navigate(
                    projectDetailRoute(workspace, asProjectPublicId(projectId), {
                      section: 'assessments',
                      assessmentId: task.case.subjectId
                    })
                  );
                }
              }
            };
            return (
              <li className={styles.task} key={task.assignment.id}>
                <div className={styles.taskMain}>
                  <div className={styles.taskTitle}>
                    {isBulk
                      ? `${subjectLabel} · ${caseKindLabel(task.case.caseKind, task.case.payload)}`
                      : caseKindLabel(task.case.caseKind, task.case.payload)}{' '}
                    · {actionLabel}
                  </div>
                  {isBulk && bulkMemberEntities.length > 0 && (
                    <div className={styles.taskMeta}>
                      {bulkMemberEntities.map((memberEntity, index) => (
                        <span key={memberEntity._uid}>
                          {index > 0 && <span>, </span>}
                          {memberEntity._publicId ? (
                            <a
                              href="#"
                              onClick={event => {
                                event.preventDefault();
                                navigate(
                                  entityDetailRoute(
                                    workspace,
                                    asEntityPublicId(memberEntity._publicId)
                                  )
                                );
                              }}
                            >
                              {memberEntity._name}
                            </a>
                          ) : (
                            memberEntity._name
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={styles.taskMeta}>
                    <span>{humanize(task.case.subjectType)}</span>
                    <span>·</span>
                    <span>{subjectLabel}</span>
                    {task.case.dueAt && (
                      <>
                        <span>·</span>
                        <span
                          className={
                            new Date(task.case.dueAt) < new Date()
                              ? styles.taskDueOverdue
                              : undefined
                          }
                        >
                          <TbClock size={11} /> Due {new Date(task.case.dueAt).toLocaleDateString()}
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
                  {latestRevision && (
                    <div className={styles.taskProposalMeta}>
                      Proposed by {latestRevision.createdByName ?? 'Unknown user'} ·{' '}
                      {new Date(latestRevision.createdAt).toLocaleString()}
                    </div>
                  )}
                  {proposalNote && (
                    <div className={styles.taskNote} title={proposalNote}>
                      <span className={styles.taskNoteLabel}>Proposer note</span>
                      <span>{previewNote(proposalNote)}</span>
                    </div>
                  )}
                  <InitiationFieldSummary fields={task.case.initiationFields} />
                </div>
                <div className={styles.taskAction}>
                  {task.requiresAction && decision && (
                    <Button
                      variant="primary"
                      disabled={decide.isPending}
                      onClick={event => {
                        event.stopPropagation();
                        decide.mutate({ assignmentId: task.assignment.id, decision });
                      }}
                    >
                      {decision === 'approve' ? 'Approve' : 'Acknowledge'}
                    </Button>
                  )}
                  {task.requiresAction &&
                    decision === 'approve' &&
                    (task.case.caseKind === 'entity.change' ||
                      task.case.caseKind === 'entity.change.bulk' ||
                      task.case.caseKind === 'document.status') && (
                      <Button
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
                  <Button
                    variant="ghost"
                    icon={<TbExternalLink size={12} />}
                    onClick={viewSubject}
                    disabled={
                      !subjectEntity?._publicId &&
                      task.case.subjectType !== 'document' &&
                      task.case.subjectType !== 'assessment'
                    }
                  >
                    {task.case.subjectType === 'entity'
                      ? 'View entity'
                      : task.case.subjectType === 'document'
                        ? 'View document'
                        : task.case.subjectType === 'assessment'
                          ? 'View assessment'
                          : 'View case'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
    </div>
  );
};
