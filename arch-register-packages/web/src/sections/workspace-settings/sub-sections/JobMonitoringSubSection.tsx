import { useEffect, useMemo, useState } from 'react';
import { TbEdit, TbHistory, TbPlayerPause, TbPlayerPlay, TbRefresh } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus } from 'react-icons/tb';
import { CreateJobDialog } from '../../../components/jobs/CreateJobDialog';
import { WorkspaceSettingsSectionHeader } from '../WorkspaceSettingsSectionHeader';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { JobRunStatus, JobSchedule } from '@arch-register/api-types/jobsContract';
import {
  useCancelJobRun,
  useJobRuns,
  useJobSchedules,
  useJobServers,
  useRunJobScheduleNow,
  useUpdateJobSchedule
} from '../../../hooks/useJobs';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import {
  ToolbarFilterBar,
  ToolbarFilterDate,
  ToolbarFilterSelect
} from '../../../components/ToolbarFilter';
import { Table } from '../../../components/table/Table';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { formatDateTime } from '../../../utils/dateFormat';
import styles from './JobMonitoringSubSection.module.css';

type RecurrenceType = 'minutes' | 'hours' | 'daily' | 'weekly';

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const toDatetimeLocal = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

const fromDatetimeLocal = (value: string) => `${value}:00.000Z`;

const ScheduleEditorDialog = ({
  schedule,
  pending,
  error,
  onClose,
  onSave
}: {
  schedule: JobSchedule | null;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  onSave: (input: {
    priority: number;
    enabled: boolean;
    recurrence:
      | { type: 'minutes'; intervalMinutes: number; startsAt: string }
      | { type: 'hours'; intervalHours: number; startsAt: string }
      | { type: 'daily'; timeUtc: string }
      | { type: 'weekly'; weekdayUtc: number; timeUtc: string };
  }) => void;
}) => {
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [intervalHours, setIntervalHours] = useState(1);
  const [startsAt, setStartsAt] = useState('');
  const [timeUtc, setTimeUtc] = useState('00:00');
  const [weekdayUtc, setWeekdayUtc] = useState(1);
  const [priority, setPriority] = useState(5);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!schedule) return;
    const recurrence = schedule.recurrence;
    setRecurrenceType(recurrence.type);
    setIntervalMinutes(recurrence.type === 'minutes' ? recurrence.intervalMinutes : 15);
    setIntervalHours(recurrence.type === 'hours' ? recurrence.intervalHours : 1);
    setStartsAt(
      recurrence.type === 'minutes' || recurrence.type === 'hours'
        ? toDatetimeLocal(recurrence.startsAt)
        : ''
    );
    setTimeUtc(
      recurrence.type === 'daily' || recurrence.type === 'weekly' ? recurrence.timeUtc : '00:00'
    );
    setWeekdayUtc(recurrence.type === 'weekly' ? recurrence.weekdayUtc : 1);
    setPriority(schedule.priority);
    setEnabled(schedule.enabled);
  }, [schedule]);

  if (!schedule) return null;

  const timeUtcValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeUtc);
  const startsAtValid = startsAt.trim() !== '';
  const recurrenceValid =
    recurrenceType === 'minutes'
      ? Number.isInteger(intervalMinutes) && intervalMinutes > 0 && startsAtValid
      : recurrenceType === 'hours'
        ? Number.isInteger(intervalHours) && intervalHours > 0 && startsAtValid
        : timeUtcValid;
  const priorityValid = Number.isInteger(priority) && priority >= 1 && priority <= 10;
  const isValid = recurrenceValid && priorityValid;

  const buildRecurrence = ():
    | { type: 'minutes'; intervalMinutes: number; startsAt: string }
    | { type: 'hours'; intervalHours: number; startsAt: string }
    | { type: 'daily'; timeUtc: string }
    | { type: 'weekly'; weekdayUtc: number; timeUtc: string } => {
    if (recurrenceType === 'minutes') {
      return { type: 'minutes', intervalMinutes, startsAt: fromDatetimeLocal(startsAt) };
    }
    if (recurrenceType === 'hours') {
      return { type: 'hours', intervalHours, startsAt: fromDatetimeLocal(startsAt) };
    }
    if (recurrenceType === 'daily') return { type: 'daily', timeUtc };
    return { type: 'weekly', weekdayUtc, timeUtc };
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit schedule: ${schedule.job_type}`}
      width={480}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: pending ? 'Saving…' : 'Save schedule',
          type: 'default',
          disabled: pending || !isValid,
          onClick: () => onSave({ priority, enabled, recurrence: buildRecurrence() })
        }
      ]}
    >
      <div className={styles.form}>
        <FormElement label="Recurrence type">
          <Select.Root
            value={recurrenceType}
            onChange={value => setRecurrenceType((value as RecurrenceType) ?? 'daily')}
            style={{ width: '100%' }}
          >
            <Select.Item value="minutes">Every N minutes</Select.Item>
            <Select.Item value="hours">Every N hours</Select.Item>
            <Select.Item value="daily">Daily</Select.Item>
            <Select.Item value="weekly">Weekly</Select.Item>
          </Select.Root>
        </FormElement>

        {recurrenceType === 'minutes' && (
          <>
            <FormElement label="Interval (minutes)">
              <NumberInput
                value={intervalMinutes}
                min={1}
                step={1}
                numberOfDecimals={0}
                onChange={value => setIntervalMinutes(value ?? 1)}
              />
            </FormElement>
            <FormElement label="Starts at (UTC)">
              <TextInput
                type="datetime-local"
                value={startsAt}
                onChange={value => setStartsAt(value ?? '')}
              />
            </FormElement>
          </>
        )}

        {recurrenceType === 'hours' && (
          <>
            <FormElement label="Interval (hours)">
              <NumberInput
                value={intervalHours}
                min={1}
                step={1}
                numberOfDecimals={0}
                onChange={value => setIntervalHours(value ?? 1)}
              />
            </FormElement>
            <FormElement label="Starts at (UTC)">
              <TextInput
                type="datetime-local"
                value={startsAt}
                onChange={value => setStartsAt(value ?? '')}
              />
            </FormElement>
          </>
        )}

        {recurrenceType === 'daily' && (
          <FormElement label="Time of day (UTC)">
            <TextInput type="time" value={timeUtc} onChange={value => setTimeUtc(value ?? '')} />
          </FormElement>
        )}

        {recurrenceType === 'weekly' && (
          <>
            <FormElement label="Day of week (UTC)">
              <Select.Root
                value={String(weekdayUtc)}
                onChange={value => setWeekdayUtc(Number(value ?? 1))}
                style={{ width: '100%' }}
              >
                {WEEKDAYS.map(day => (
                  <Select.Item key={day.value} value={String(day.value)}>
                    {day.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
            <FormElement label="Time of day (UTC)">
              <TextInput type="time" value={timeUtc} onChange={value => setTimeUtc(value ?? '')} />
            </FormElement>
          </>
        )}

        <FormElement label="Priority (1-10)">
          <NumberInput
            value={priority}
            min={1}
            max={10}
            step={1}
            numberOfDecimals={0}
            onChange={value => setPriority(value ?? 5)}
          />
        </FormElement>

        <label className={styles.check}>
          <Checkbox value={enabled} onChange={value => setEnabled(value ?? false)} /> Enabled
        </label>

        {error && <div className={styles.error}>{error.message}</div>}
      </div>
    </Dialog>
  );
};

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
  type: 'minutes' | 'hours' | 'daily' | 'weekly';
  intervalMinutes?: number;
  intervalHours?: number;
  startsAt?: string;
  weekdayUtc?: number;
  timeUtc?: string;
}) => {
  if (recurrence.type === 'minutes') {
    return `Every ${recurrence.intervalMinutes} minute(s) from ${formatDateTime(recurrence.startsAt)}`;
  }
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

type JobsTab = 'schedules' | 'history' | 'servers';

export const JobMonitoringSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { canManageJobs } = useWorkspaceAuthorization(workspaceSlug);
  const [tab, setTab] = useState<JobsTab>('schedules');
  const [scheduleId, setScheduleId] = useState('');
  const [status, setStatus] = useState<'' | JobRunStatus>('');
  const [plannedFrom, setPlannedFrom] = useState('');
  const [plannedTo, setPlannedTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<JobSchedule | null>(null);
  const [runNowTarget, setRunNowTarget] = useState<string | null>(null);
  const [runNowError, setRunNowError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    data: servers = [],
    isLoading: serversLoading,
    isError: serversError,
    refetch: refetchServers
  } = useJobServers(workspaceSlug);

  const {
    data: schedules = [],
    isLoading: schedulesLoading,
    isError: schedulesError,
    refetch: refetchSchedules
  } = useJobSchedules(workspaceSlug);
  const runFilters = useMemo(
    () => ({
      scheduleId: scheduleId ?? undefined,
      status: status === '' ? undefined : status,
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
  } = useJobRuns(workspaceSlug, runFilters, tab === 'history');
  const cancelRun = useCancelJobRun(workspaceSlug);
  const updateSchedule = useUpdateJobSchedule(workspaceSlug);
  const runScheduleNow = useRunJobScheduleNow(workspaceSlug);

  const handleRunNow = (schedule: JobSchedule) => {
    setRunNowError(null);
    setRunNowTarget(schedule.id);
    runScheduleNow.mutate(schedule.id, {
      onError: error => setRunNowError((error as Error).message),
      onSettled: () => setRunNowTarget(null)
    });
  };

  const pageCount = Math.max(1, Math.ceil((runs?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const updateFilter = (update: () => void) => {
    update();
    setOffset(0);
  };

  const showScheduleHistory = (schedule: (typeof schedules)[number]) => {
    updateFilter(() => setScheduleId(schedule.id === scheduleId ? '' : schedule.id));
    setTab('history');
  };

  return (
    <>
      <WorkspaceSettingsSectionHeader
        section="jobs"
        buttons={
          <>
            <Button
              icon={<TbRefresh size={12} />}
              onClick={() =>
                void Promise.all([refetchServers(), refetchSchedules(), refetchRuns()])
              }
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Add job
            </Button>
          </>
        }
      />
      <CreateJobDialog
        open={createDialogOpen}
        workspaceSlug={workspaceSlug}
        onClose={() => setCreateDialogOpen(false)}
      />
      <div className={styles.stack}>
        <Tabs.Root value={tab} onValueChange={v => setTab(v as JobsTab)}>
          <Tabs.List>
            <Tabs.Trigger value="schedules">Schedules ({schedules.length})</Tabs.Trigger>
            <Tabs.Trigger value="history">Run history</Tabs.Trigger>
            <Tabs.Trigger value="servers">Servers ({servers.length})</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        {tab === 'servers' && (
          <section className={styles.section}>
            {serversLoading ? (
              <LoadingState text="Loading job servers…" size="sm" />
            ) : serversError ? (
              <div className={styles.error}>Job servers could not be loaded.</div>
            ) : servers.length === 0 ? (
              <EmptyState compact title="No job servers have registered yet." />
            ) : (
              <div className={styles.tableWrap}>
                <Table.Root layout="fixed" bordered={false}>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell width={130}>Status</Table.HeaderCell>
                      <Table.HeaderCell width={180}>Last seen</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {servers.map(server => (
                      <Table.Row key={server.id}>
                        <Table.Cell>
                          <div>{server.name}</div>
                          <div className={styles.muted}>{server.id}</div>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            dot={server.status === 'available' ? 'var(--green)' : 'var(--error-fg)'}
                            tone="ghost"
                          >
                            {server.status === 'available' ? 'Available' : 'Unavailable'}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>{formatDateTime(server.last_seen_at)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </div>
            )}
          </section>
        )}

        {tab === 'schedules' && (
          <section className={styles.section}>
            {runNowError && <div className={styles.error}>{runNowError}</div>}
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
                      <Table.HeaderCell>Target schema</Table.HeaderCell>
                      <Table.HeaderCell>Recurrence</Table.HeaderCell>
                      <Table.HeaderCell width={70} numeric>
                        Priority
                      </Table.HeaderCell>
                      <Table.HeaderCell width={90}>State</Table.HeaderCell>
                      <Table.HeaderCell width={170}>Next planned run</Table.HeaderCell>
                      <Table.HeaderCell width={48} />
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {schedules.map(schedule => (
                      <Table.Row
                        key={schedule.id}
                        selected={schedule.id === scheduleId}
                        onClick={() =>
                          canManageJobs ? setEditTarget(schedule) : showScheduleHistory(schedule)
                        }
                      >
                        <Table.Cell>
                          <div className={styles.name}>{schedule.job_type}</div>
                          <div className={styles.muted}>{schedule.system_identity}</div>
                        </Table.Cell>
                        <Table.Cell>
                          {schedule.target_schema_name ?? <span className={styles.muted}>—</span>}
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
                        <Table.ActionsCell>
                          <DropdownMenu
                            trigger={
                              <Table.DotsButton aria-label={`Actions for ${schedule.job_type}`} />
                            }
                            items={
                              [
                                ...(canManageJobs
                                  ? [
                                      {
                                        label: 'Edit',
                                        icon: <TbEdit size={14} />,
                                        onClick: () => setEditTarget(schedule)
                                      },
                                      {
                                        label:
                                          runNowTarget === schedule.id ? 'Starting…' : 'Run now',
                                        icon: <TbPlayerPlay size={14} />,
                                        disabled: !schedule.enabled || runNowTarget === schedule.id,
                                        onClick: () => handleRunNow(schedule)
                                      }
                                    ]
                                  : []),
                                {
                                  label: 'View run history',
                                  icon: <TbHistory size={14} />,
                                  onClick: () => showScheduleHistory(schedule)
                                }
                              ] satisfies MenuItem[]
                            }
                          />
                        </Table.ActionsCell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </div>
            )}
          </section>
        )}

        {tab === 'history' && (
          <>
            <ToolbarFilterBar noPadding>
              <ToolbarFilterSelect
                label="Schedule"
                value={scheduleId}
                onChange={value => updateFilter(() => setScheduleId(value))}
                options={[
                  { value: '', label: 'All schedules' },
                  ...schedules.map(schedule => ({ value: schedule.id, label: schedule.job_type }))
                ]}
              />
              <ToolbarFilterSelect
                label="Status"
                value={status}
                onChange={value => updateFilter(() => setStatus(value as '' | JobRunStatus))}
                options={STATUS_OPTIONS}
              />
              <ToolbarFilterDate
                label="Planned from"
                value={plannedFrom}
                onChange={value => updateFilter(() => setPlannedFrom(value))}
              />
              <ToolbarFilterDate
                label="Planned to"
                value={plannedTo}
                onChange={value => updateFilter(() => setPlannedTo(value))}
              />
            </ToolbarFilterBar>
            <section className={styles.section}>
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
                              <div className={styles.name}>{run.job_type}</div>
                              <div className={styles.muted}>
                                Priority {run.priority} · attempt {run.attempt_count}/
                                {run.max_attempts}
                              </div>
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
                      {runs.total} run{runs.total === 1 ? '' : 's'} · page {currentPage} of{' '}
                      {pageCount}
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
          </>
        )}

        <ScheduleEditorDialog
          schedule={editTarget}
          pending={updateSchedule.isPending}
          error={updateSchedule.error as Error | null}
          onClose={() => setEditTarget(null)}
          onSave={input => {
            if (editTarget == null) return;
            void updateSchedule.mutateAsync({ id: editTarget.id, body: input }).then(() => {
              setEditTarget(null);
            });
          }}
        />

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
    </>
  );
};
