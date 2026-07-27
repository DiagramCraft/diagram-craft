import type { DatabaseAdapter } from '../../db/database';
import { createJobSchedule } from '../jobs/jobOperations';
import { getSystemUserId } from '../auth/systemUsers';
import { recordGovernanceEvent } from './governanceOperations';
import type { GovernanceRegistry } from './governanceRegistry';

// #2418: a recurring per-workspace scan that reminds assignees as a governance case's due_at
// approaches or passes, and records a `reminder_sent` event (which createGovernanceInAppNotifications
// already turns into notifications for free, via recordGovernanceEvent). Scan-based rather than
// per-case one-off scheduling: case creation is centralized but case completion/cancellation is
// duplicated across ~9 call sites, so a scan (which just re-checks status === 'open' each tick)
// avoids needing to touch any of them to cancel pending jobs.
export const GOVERNANCE_DEADLINE_SCAN_JOB_TYPE = 'governance-deadline.scan';
export const GOVERNANCE_DEADLINE_SCAN_SYSTEM_IDENTITY = 'governance-deadline-scan';
export const GOVERNANCE_DEADLINE_SCAN_INTERVAL_MINUTES = 60;

const GOVERNANCE_DEADLINE_SCAN_SYSTEM_USER_ID = getSystemUserId('governance-deadline-scan-job');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const ensureGovernanceDeadlineScanSchedule = async (
  db: DatabaseAdapter,
  workspace: string,
  now = new Date()
) => {
  const schedules = await db.jobs.listSchedules(workspace);
  const existing = schedules.find(
    schedule => schedule.job_type === GOVERNANCE_DEADLINE_SCAN_JOB_TYPE
  );
  if (existing) return existing;
  return createJobSchedule(
    db,
    {
      workspace,
      jobType: GOVERNANCE_DEADLINE_SCAN_JOB_TYPE,
      systemIdentity: GOVERNANCE_DEADLINE_SCAN_SYSTEM_IDENTITY,
      payload: {},
      priority: 5,
      recurrence: {
        type: 'minutes',
        intervalMinutes: GOVERNANCE_DEADLINE_SCAN_INTERVAL_MINUTES,
        startsAt: now
      }
    },
    now
  );
};

export const ensureAllGovernanceDeadlineScanSchedules = async (
  db: DatabaseAdapter,
  now = new Date()
) => {
  const workspaces = await db.workspace.listWorkspaces();
  for (const workspace of workspaces) {
    await ensureGovernanceDeadlineScanSchedule(db, workspace.id, now);
  }
};

// Exported for tests; not part of the public job-wiring surface.
export const computeCandidateReminderWindows = (
  dueAt: Date,
  now: Date,
  windows: { approachingDays: number[]; overdueDays: number[] },
  alreadySent: string[]
): string[] => {
  const daysUntilDue = Math.floor((dueAt.getTime() - now.getTime()) / MS_PER_DAY);
  const candidates = [
    ...windows.approachingDays
      .filter(d => daysUntilDue <= d && daysUntilDue >= 0)
      .map(d => `approaching:${d}`),
    ...windows.overdueDays.filter(d => -daysUntilDue >= d).map(d => `overdue:${d}`)
  ];
  return candidates.filter(window => !alreadySent.includes(window));
};

export const createGovernanceDeadlineScanJobHandler =
  (db: DatabaseAdapter, registry: GovernanceRegistry) =>
  async (context: {
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const cases = await db.governance.listCases(context.workspace, { status: 'open' });
    const now = new Date();
    let remindersSent = 0;

    for (const caseRow of cases) {
      if (context.signal?.aborted) break;
      if (!caseRow.due_at) continue;

      const codeDefault = registry.get(caseRow.case_kind)?.reminderWindows;
      if (!codeDefault) continue;

      const override = await db.governanceReminderConfig.getReminderConfig(
        context.workspace,
        caseRow.case_kind
      );
      if (override && !override.enabled) continue;
      const windows = override
        ? { approachingDays: override.approaching_days, overdueDays: override.overdue_days }
        : codeDefault;

      const candidateWindows = computeCandidateReminderWindows(
        caseRow.due_at,
        now,
        windows,
        caseRow.reminder_windows_sent
      );

      for (const window of candidateWindows) {
        await db.core.transaction(async tx => {
          const fresh = await tx.governance.getCase(context.workspace, caseRow.id);
          if (fresh?.status !== 'open' || fresh.reminder_windows_sent.includes(window)) {
            return;
          }
          await recordGovernanceEvent(tx, fresh, {
            eventType: 'reminder_sent',
            actorUserId: GOVERNANCE_DEADLINE_SCAN_SYSTEM_USER_ID,
            previousStatus: fresh.status,
            resultingStatus: fresh.status,
            reason: null,
            metadata: { trigger: 'scheduled', window }
          });
          await tx.governance.addReminderWindowSent(fresh.id, window);
        });
        remindersSent += 1;
      }
    }

    return { scanned: cases.length, remindersSent };
  };
