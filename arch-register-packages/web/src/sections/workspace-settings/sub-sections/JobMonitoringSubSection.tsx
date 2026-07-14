import { useMemo, useState } from 'react';
import { TbPlayerPause, TbRefresh } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import type { JobRunStatus } from '@arch-register/api-types/jobsContract';
import { useCancelJobRun, useJobRuns, useJobSchedules } from '../../../hooks/useJobs';
import { Table } from '../../../components/table/Table';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { formatDateTime } from '../../../utils/dateFormat';
import styles from './JobMonitoringSubSection.module.css';

const PAGE_SIZE = 50;

const STATUS_OPTIONS: Array<{ value: '' | JobRunStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const statusColor: Record<JobRunStatus, string> = {
  queued: 'var(--warning-fg)',
  running: 'var(--blue)',
  succeeded: 'var(--green)',
  failed: 'var(--error-fg)',
  cancelled: 'var(--cmp-fg-disabled)'
};

const formatDuration = (value: number | null) => {
  if (value == null) return '—';
  if (value < 1000) return `${value} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

const formatRecurrence = (recurrence: {
  type: 'hours' | 'daily' | 'weekly';
  intervalHours?: number;
  startsAt?: string;
  weekdayUtc?: number;
  timeUtc?: string;
}) => {
  if (recurrence.type === 'hours') {
    return `Every ${recurrence.intervalHours} hour(s) from ${formatDateTime(recurrence.startsAt)}`;
  }
  if (recurrence.type === 'daily') return `Daily at ${recurrence.timeUtc} UTC`;
  return `Weekly on day ${recurrence.weekdayUtc} at ${recurrence.timeUtc} UTC`;
};

const formatSummary = (result: Record<string, unknown> | null, error: string | null) => {
  if (error) return error;
  if (result == null) return '—';
  return JSON.stringify(result);
};

export const JobMonitoringSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const [scheduleId, setScheduleId] = useState('');
  const [status, setStatus] = useState<'' | JobRunStatus>('');
  const [plannedFrom, setPlannedFrom] = useState('');
  const [plannedTo, setPlannedTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const {
    data: schedules = [],
    isLoading: schedulesLoading,
    isError: schedulesError,
    refetch: refetchSchedules
  } = useJobSchedules(workspaceSlug);
  const runFilters = useMemo(
    () => ({
      scheduleId: scheduleId || undefined,
      status: status || undefined,
      plannedFrom: plannedFrom ? `${plannedFrom}T00:00:00.000Z` : undefined,
      plannedTo: plannedTo ? `${plannedTo}T23:59:59.999Z` : undefined,
      limit: PAGE_SIZE,
      offset
    }),
    [offset, plannedFrom, plannedTo, scheduleId, status]
  );
  const {
    data: runs,
    isLoading: runsLoading,
    isError: runsError,
    refetch: refetchRuns
  } = useJobRuns(workspaceSlug, runFilters);
  const cancelRun = useCancelJobRun(workspaceSlug);

  const pageCount = Math.max(1, Math.ceil((runs?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const updateFilter = (update: () => void) => {
    update();
    setOffset(0);
  };

  const selectedSchedule = schedules.find(schedule => schedule.id === scheduleId);

  return (
    <div className={styles.stack}>
      <div className={styles.notice}>
        Planned execution times are best-effort. A queued run may start later when workers are at
        capacity or another scheduled job is using this workspace. Running jobs cannot be stopped
        from here.
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Recurring schedules</div>
          <div className={styles.sectionSub}>Schedules are managed by system components.</div>
        </div>
        {schedulesLoading ? (
          <LoadingState text="Loading schedules…" size="sm" />
        ) : schedulesError ? (
          <div className={styles.error}>Schedules could not be loaded.</div>
        ) : schedules.length === 0 ? (
          <EmptyState compact title="No recurring schedules exist for this workspace." />
        ) : (
          <div className={styles.tableWrap}>
            <Table.Root layout="fixed" bordered={false}>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Job type</Table.HeaderCell>
                  <Table.HeaderCell>Recurrence</Table.HeaderCell>
                  <Table.HeaderCell width={70}>Priority</Table.HeaderCell>
                  <Table.HeaderCell width={90}>State</Table.HeaderCell>
                  <Table.HeaderCell width={170}>Next planned run</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {schedules.map(schedule => (
                  <Table.Row
                    key={schedule.id}
                    selected={schedule.id === scheduleId}
                    onClick={() =>
                      updateFilter(() =>
                        setScheduleId(schedule.id === scheduleId ? '' : schedule.id)
                      )
                    }
                  >
                    <Table.Cell>
                      <div>{schedule.job_type}</div>
                      <div className={styles.muted}>{schedule.system_identity}</div>
                    </Table.Cell>
                    <Table.Cell>{formatRecurrence(schedule.recurrence)}</Table.Cell>
                    <Table.Cell numeric>{schedule.priority}</Table.Cell>
                    <Table.Cell>
                      <Chip
                        dot={schedule.enabled ? 'var(--green)' : 'var(--cmp-fg-disabled)'}
                        tone="ghost"
                      >
                        {schedule.enabled ? 'Enabled' : 'Disabled'}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{formatDateTime(schedule.next_occurrence_at)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionTitle}>Run history</div>
            <div className={styles.sectionSub}>
              {selectedSchedule
                ? `Filtered to ${selectedSchedule.job_type}`
                : 'Retained indefinitely'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<TbRefresh size={13} />}
            onClick={() => void Promise.all([refetchSchedules(), refetchRuns()])}
          >
            Refresh
          </Button>
        </div>
        <div className={styles.filters}>
          <select
            aria-label="Schedule"
            className={styles.input}
            value={scheduleId}
            onChange={event => updateFilter(() => setScheduleId(event.target.value))}
          >
            <option value="">All schedules</option>
            {schedules.map(schedule => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.job_type}
              </option>
            ))}
          </select>
          <select
            aria-label="Status"
            className={styles.input}
            value={status}
            onChange={event =>
              updateFilter(() => setStatus(event.target.value as '' | JobRunStatus))
            }
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Planned from"
            className={styles.input}
            type="date"
            value={plannedFrom}
            onChange={event => updateFilter(() => setPlannedFrom(event.target.value))}
          />
          <input
            aria-label="Planned to"
            className={styles.input}
            type="date"
            value={plannedTo}
            onChange={event => updateFilter(() => setPlannedTo(event.target.value))}
          />
        </div>
        {runsLoading ? (
          <LoadingState text="Loading job history…" size="sm" />
        ) : runsError ? (
          <div className={styles.error}>Job history could not be loaded.</div>
        ) : runs == null || runs.items.length === 0 ? (
          <EmptyState compact title="No job runs match the current filters." />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <Table.Root layout="fixed" bordered={false}>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell width={150}>Job</Table.HeaderCell>
                    <Table.HeaderCell width={155}>Planned</Table.HeaderCell>
                    <Table.HeaderCell width={155}>Started</Table.HeaderCell>
                    <Table.HeaderCell width={155}>Completed</Table.HeaderCell>
                    <Table.HeaderCell width={90}>Queue</Table.HeaderCell>
                    <Table.HeaderCell width={90}>Duration</Table.HeaderCell>
                    <Table.HeaderCell width={100}>Status</Table.HeaderCell>
                    <Table.HeaderCell>Worker / result</Table.HeaderCell>
                    <Table.HeaderCell width={90}>Action</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {runs.items.map(run => (
                    <Table.Row key={run.id}>
                      <Table.Cell>
                        <div>{run.job_type}</div>
                        <div className={styles.muted}>Priority {run.priority}</div>
                      </Table.Cell>
                      <Table.Cell>{formatDateTime(run.planned_at)}</Table.Cell>
                      <Table.Cell>{formatDateTime(run.started_at)}</Table.Cell>
                      <Table.Cell>{formatDateTime(run.completed_at)}</Table.Cell>
                      <Table.Cell>{formatDuration(run.queue_delay_ms)}</Table.Cell>
                      <Table.Cell>{formatDuration(run.duration_ms)}</Table.Cell>
                      <Table.Cell>
                        <Chip dot={statusColor[run.status]} tone="ghost">
                          {run.status}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <div>{run.worker_id ?? 'Not started'}</div>
                        <div
                          className={styles.summary}
                          title={formatSummary(run.result, run.error)}
                        >
                          {formatSummary(run.result, run.error)}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {run.status === 'queued' ? (
                          <Button
                            variant="danger"
                            size="xs"
                            icon={<TbPlayerPause size={12} />}
                            onClick={() => setCancelTarget(run.id)}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </div>
            <div className={styles.pagination}>
              <div className={styles.pageLabel}>
                {runs.total} run{runs.total === 1 ? '' : 's'} · page {currentPage} of {pageCount}
              </div>
              <Button
                variant="secondary"
                size="xs"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="xs"
                disabled={currentPage >= pageCount}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </section>

      <DeleteConfirmationDialog
        open={cancelTarget != null}
        title="Cancel queued run?"
        message="This queued run will be marked as cancelled. The recurring schedule will continue producing future runs."
        detail="Running jobs cannot be killed from the workspace admin UI."
        confirmLabel={cancelRun.isPending ? 'Cancelling…' : 'Cancel run'}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget == null || cancelRun.isPending) return;
          void cancelRun.mutateAsync(cancelTarget).then(() => setCancelTarget(null));
        }}
      />
    </div>
  );
};
