import { useState } from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import { LabeledSelect } from '../../components/LabeledSelect';
import { Title } from '../../components/Title';
import { useGovernanceSubmissions, useGovernanceTasks } from '../../hooks/useGovernance';
import { useGovernanceWorkflowConfig } from '../../hooks/useGovernanceWorkflowConfig';
import { GovernanceSubmissionList, filterSubmissions } from './GovernanceSubmissionList';
import type { SubmissionStatusFilter } from './GovernanceSubmissionList';
import { GovernanceTaskList } from './GovernanceTaskList';
import { useCaseSubjects } from './useCaseSubjects';
import styles from './GovernanceInboxScreen.module.css';

type TaskKind = 'approve' | 'acknowledge' | 'review' | 'remediate';

const DAY_MS = 24 * 60 * 60 * 1000;

export const GovernanceInboxScreen = () => {
  const { workspaceSlug } = useParams({ strict: false });
  const workspace = workspaceSlug ?? '';
  const { scope = 'assigned' } = useSearch({ strict: false }) as {
    scope?: 'assigned' | 'submitted';
  };
  const { data: workflowConfig } = useGovernanceWorkflowConfig(workspace);

  const [state, setState] = useState<'open' | 'completed'>('open');
  const [taskKind, setTaskKind] = useState('');
  const [caseKind, setCaseKind] = useState('');
  const [due, setDue] = useState<'all' | 'overdue' | 'week'>('all');
  const [submittedStatus, setSubmittedStatus] = useState<SubmissionStatusFilter>('open');

  const now = new Date();
  const dueBefore =
    due === 'overdue'
      ? now.toISOString()
      : due === 'week'
        ? new Date(now.getTime() + 7 * DAY_MS).toISOString()
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
      ...(taskKind ? { taskKind: taskKind as TaskKind } : {}),
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
      // 'open' also needs completed-but-request_changes cases, so it fetches unfiltered and is
      // narrowed client-side by `filterSubmissions` instead of asking for status: 'open'
      ...(submittedStatus === 'open' ? {} : { status: submittedStatus }),
      ...(caseKind ? { caseKind } : {})
    },
    !!workspace && scope === 'submitted'
  );

  const subjects = useCaseSubjects(workspace, [
    ...tasks.map(task => task.case),
    ...rawSubmissions.map(submission => submission.case)
  ]);
  const submissions = filterSubmissions(
    rawSubmissions,
    submittedStatus,
    subjects.isProposalWithdrawn
  );

  const isLoading = scope === 'assigned' ? tasksLoading : submissionsLoading;
  const error = scope === 'assigned' ? tasksError : submissionsError;

  return (
    <div className={styles.screen}>
      <Title
        eyebrow="Governance"
        title={scope === 'assigned' ? 'Assigned to me' : 'Requested by me'}
        description={
          scope === 'assigned'
            ? 'Governance tasks assigned to you or available through your workspace roles.'
            : 'Governance cases you have requested.'
        }
      />

      <div className={styles.toolbar}>
        {scope === 'assigned' ? (
          <>
            <LabeledSelect
              label="State"
              value={state}
              onChange={value => setState(value as 'open' | 'completed')}
              options={[
                { value: 'open', label: 'Open tasks' },
                { value: 'completed', label: 'Completed history' }
              ]}
            />
            <LabeledSelect
              label="Kind"
              value={taskKind}
              onChange={setTaskKind}
              options={[
                { value: '', label: 'All task kinds' },
                { value: 'approve', label: 'Approve' },
                { value: 'acknowledge', label: 'Acknowledge' },
                { value: 'review', label: 'Review' },
                { value: 'remediate', label: 'Remediate' }
              ]}
            />
          </>
        ) : (
          <LabeledSelect
            label="Status"
            value={submittedStatus}
            onChange={value => setSubmittedStatus(value as SubmissionStatusFilter)}
            options={[
              { value: 'open', label: 'Needs attention' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Withdrawn / cancelled' }
            ]}
          />
        )}
        <LabeledSelect
          label="Case"
          value={caseKind}
          onChange={setCaseKind}
          options={[
            { value: '', label: 'All case kinds' },
            ...(workflowConfig?.case_kinds ?? []).map(kind => ({
              value: kind.case_kind,
              label: kind.label
            }))
          ]}
        />
        {scope === 'assigned' && (
          <LabeledSelect
            label="Due"
            value={due}
            onChange={value => setDue(value as 'all' | 'overdue' | 'week')}
            options={[
              { value: 'all', label: 'Any due date' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'week', label: 'Due in 7 days' }
            ]}
          />
        )}
      </div>

      <div className={styles.summary}>
        {isLoading
          ? 'Loading…'
          : scope === 'assigned'
            ? `${tasks.length} ${state === 'open' ? 'open task' : 'completed task'}${tasks.length === 1 ? '' : 's'}`
            : `${submissions.length} request${submissions.length === 1 ? '' : 's'}`}
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          My work could not be loaded. Your access may have changed; reload to try again.
        </div>
      ) : scope === 'submitted' ? (
        <GovernanceSubmissionList
          workspace={workspace}
          submissions={submissions}
          isLoading={isLoading}
          subjects={subjects}
        />
      ) : (
        <GovernanceTaskList
          workspace={workspace}
          tasks={tasks}
          isLoading={isLoading}
          state={state}
          subjects={subjects}
        />
      )}
    </div>
  );
};
