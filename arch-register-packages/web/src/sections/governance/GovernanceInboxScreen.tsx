import { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { TbClipboardCheck, TbClock, TbExternalLink } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Title } from '../../components/Title';
import {
  governanceKeys,
  useDecideGovernanceAssignment,
  useGovernanceSubmissions,
  useGovernanceTasks,
  useWithdrawGovernanceCase
} from '../../hooks/useGovernance';
import type {
  GovernanceAssignment,
  GovernanceSubmission,
  GovernanceTask
} from '@arch-register/api-types/governanceContract';
import styles from './GovernanceInboxScreen.module.css';
import { orpcClient } from '../../lib/orpcClient';
import { entityDetailRoute, asEntityPublicId } from '../../routes/publicObjectRoutes';
import { entityKeys } from '../../queries/entities';
import { entityChangeKeys, useWithdrawEntityChangeProposal } from '../../hooks/useEntityChanges';

const humanize = (value: string) =>
  value.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

const previewNote = (note: string) => (note.length > 180 ? `${note.slice(0, 177)}…` : note);

const describeWaitingOn = (assignment: GovernanceAssignment) => {
  const action = humanize(assignment.action);
  if (assignment.targetType === 'user') return `Awaiting ${action.toLowerCase()}`;
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
  const [requestChangesTask, setRequestChangesTask] = useState<GovernanceTask | null>(null);
  const [requestChangesReason, setRequestChangesReason] = useState('');
  const isLoading = scope === 'assigned' ? tasksLoading : submissionsLoading;
  const error = scope === 'assigned' ? tasksError : submissionsError;
  const entityIds = [
    ...new Set([
      ...tasks.filter(task => task.case.subjectType === 'entity').map(task => task.case.subjectId),
      ...rawSubmissions
        .filter(submission => submission.case.subjectType === 'entity')
        .map(submission => submission.case.subjectId)
    ])
  ];
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => ({
      queryKey: entityKeys.detail(workspace, entityId),
      queryFn: () => orpcClient.entities.get({ params: { workspace, id: entityId } }),
      enabled: !!workspace
    }))
  });
  const entitiesById = new Map(
    entityIds.map((entityId, index) => [entityId, entityQueries[index]?.data])
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
    queries: entityChangeIds.map(entityId => ({
      queryKey: entityChangeKeys.current(workspace, entityId),
      queryFn: () => orpcClient.entityChanges.get({ params: { workspace, id: entityId } }),
      enabled: !!workspace
    }))
  });
  const proposalsByEntityId = new Map(
    entityChangeIds.map((entityId, index) => [entityId, proposalQueries[index]?.data])
  );
  const withdrawEntityChangeProposal = useWithdrawEntityChangeProposal(workspace);
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
      return submission.case.status === 'completed' && submission.case.outcome !== 'request_changes';
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
    queries: requestChangesCaseIds.map(caseId => ({
      queryKey: [...governanceKeys.all, 'events', workspace, caseId],
      queryFn: () => orpcClient.governance.cases.events({ params: { workspace, id: caseId } }),
      enabled: !!workspace
    }))
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
        withdrawEntityChangeProposal.mutate({
          entityId: submission.case.subjectId,
          proposalId: proposal.id
        });
      }
      return;
    }
    withdrawCase.mutate({ caseId: submission.case.id });
  };

  const submitRequestChanges = () => {
    if (!requestChangesTask) return;
    const reason = requestChangesReason.trim();
    if (reason === '') return;
    decide.mutate(
      { assignmentId: requestChangesTask.assignment.id, decision: 'request_changes', reason },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: entityChangeKeys.current(workspace, requestChangesTask.case.subjectId)
          });
          await queryClient.invalidateQueries({
            queryKey: entityKeys.detail(workspace, requestChangesTask.case.subjectId)
          });
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
              const subjectEntity =
                submission.case.subjectType === 'entity'
                  ? entitiesById.get(submission.case.subjectId)
                  : undefined;
              const subjectLabel = subjectEntity?._name ?? submission.case.subjectId;
              const proposal = proposalsByEntityId.get(submission.case.subjectId);
              const latestRevision = proposal?.revisions.at(-1);
              const proposalNote = latestRevision?.message;
              const viewSubject = () => {
                if (subjectEntity?._publicId) {
                  navigate(entityDetailRoute(workspace, asEntityPublicId(subjectEntity._publicId)));
                }
              };
              const withdrawPending =
                submission.case.caseKind === 'entity.change'
                  ? withdrawEntityChangeProposal.isPending
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
                  (submission.case.caseKind === 'entity.change' &&
                    submission.case.outcome === 'request_changes'));
              return (
                <li className={styles.task} key={submission.case.id}>
                  <div className={styles.taskMain}>
                    <div className={styles.taskTitle}>{humanize(submission.case.caseKind)}</div>
                    <div className={styles.taskMeta}>
                      <span>{humanize(submission.case.subjectType)}</span>
                      <span>·</span>
                      <span>{subjectLabel}</span>
                      <span>·</span>
                      <span>Submitted {new Date(submission.case.createdAt).toLocaleString()}</span>
                    </div>
                    <div className={styles.taskProposalMeta}>
                      {isEntityChangeProposalWithdrawn(submission)
                        ? 'Status: Withdrawn'
                        : submission.case.status === 'open'
                          ? submission.openAssignments.length > 0
                            ? submission.openAssignments.map(describeWaitingOn).join(' · ')
                            : 'Awaiting review'
                          : `Status: ${humanize(submission.case.status)}${
                              submission.case.outcome ? ` (${humanize(submission.case.outcome)})` : ''
                            }`}
                    </div>
                    {proposalNote && (
                      <div className={styles.taskNote} title={proposalNote}>
                        <span className={styles.taskNoteLabel}>Your note</span>
                        <span>{previewNote(proposalNote)}</span>
                      </div>
                    )}
                    {requestChangesReason && (
                      <div className={styles.taskNote} title={requestChangesReason}>
                        <span className={styles.taskNoteLabel}>Reviewer requested changes</span>
                        <span>{previewNote(requestChangesReason)}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.taskAction}>
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
                      disabled={!subjectEntity?._publicId}
                    >
                      {submission.case.subjectType === 'entity' ? 'View entity' : 'View case'}
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
            const subjectEntity =
              task.case.subjectType === 'entity'
                ? entitiesById.get(task.case.subjectId)
                : undefined;
            const subjectLabel = subjectEntity?._name ?? task.case.subjectId;
            const proposal = proposalsByEntityId.get(task.case.subjectId);
            const latestRevision = proposal?.revisions.at(-1);
            const proposalNote = latestRevision?.message;
            const viewSubject = () => {
              if (subjectEntity?._publicId) {
                navigate(entityDetailRoute(workspace, asEntityPublicId(subjectEntity._publicId)));
              }
            };
            return (
              <li className={styles.task} key={task.assignment.id}>
                <div className={styles.taskMain}>
                  <div className={styles.taskTitle}>
                    {humanize(task.case.caseKind)} · {actionLabel}
                  </div>
                  <div className={styles.taskMeta}>
                    <span>{humanize(task.case.subjectType)}</span>
                    <span>·</span>
                    <span>{subjectLabel}</span>
                    {task.case.dueAt && (
                      <>
                        <span>·</span>
                        <span>
                          <TbClock size={11} /> Due {new Date(task.case.dueAt).toLocaleDateString()}
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
                    task.case.caseKind === 'entity.change' && (
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
                    disabled={!subjectEntity?._publicId}
                  >
                    {task.case.subjectType === 'entity' ? 'View entity' : 'View case'}
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
