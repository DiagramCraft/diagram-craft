import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { TbClipboardCheck, TbClock, TbExternalLink } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../components/Title';
import { useDecideGovernanceAssignment, useGovernanceTasks } from '../../hooks/useGovernance';
import type { GovernanceTask } from '@arch-register/api-types/governanceContract';
import styles from './GovernanceInboxScreen.module.css';
import { orpcClient } from '../../lib/orpcClient';
import { entityDetailRoute, asEntityPublicId } from '../../routes/publicObjectRoutes';
import { entityKeys } from '../../queries/entities';
import { entityChangeKeys } from '../../hooks/useEntityChanges';

const humanize = (value: string) =>
  value.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

const previewNote = (note: string) => (note.length > 180 ? `${note.slice(0, 177)}…` : note);

export const GovernanceInboxScreen = () => {
  const { workspaceSlug } = useParams({ strict: false });
  const navigate = useNavigate();
  const workspace = workspaceSlug ?? '';
  const [state, setState] = useState<'open' | 'completed'>('open');
  const [taskKind, setTaskKind] = useState('');
  const [caseKind, setCaseKind] = useState('');
  const [due, setDue] = useState<'all' | 'overdue' | 'week'>('all');
  const now = new Date();
  const dueBefore =
    due === 'overdue'
      ? now.toISOString()
      : due === 'week'
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
  const {
    data: tasks = [],
    isLoading,
    error
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
    !!workspace
  );
  const decide = useDecideGovernanceAssignment(workspace);
  const entityIds = [
    ...new Set(
      tasks.filter(task => task.case.subjectType === 'entity').map(task => task.case.subjectId)
    )
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
    ...new Set(
      tasks
        .filter(
          task => task.case.caseKind === 'entity.change' && task.case.subjectType === 'entity'
        )
        .map(task => task.case.subjectId)
    )
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

  return (
    <div className={styles.screen}>
      <Title
        eyebrow="Governance"
        title="My work"
        description="Governance tasks assigned to you or available through your workspace roles."
        buttons={<TbClipboardCheck size={20} />}
      />

      <div className={styles.toolbar}>
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
        <input
          className={styles.input}
          aria-label="Case kind"
          placeholder="Filter case kind"
          value={caseKind}
          onChange={event => setCaseKind(event.target.value)}
        />
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
      </div>

      <div className={styles.summary}>
        {isLoading
          ? 'Loading tasks…'
          : `${tasks.length} ${state === 'open' ? 'open task' : 'completed task'}${tasks.length === 1 ? '' : 's'}`}
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          My work could not be loaded. Your access may have changed; reload to try again.
        </div>
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
    </div>
  );
};
