import type { DatabaseAdapter } from '../../db/database';
import { createJobSchedule } from '../jobs/jobOperations';
import { getSystemUserId } from '../auth/systemUsers';
import { recordGovernanceEvent } from './governanceOperations';
import type { GovernanceRegistry } from './governanceRegistry';
import {
  FIELD_DATE_REMINDER_CASE_KIND,
  syncFieldDateReminderCases
} from '../catalog/fieldDateReminderJob';
import { defaultWorkflowConfigForCaseKind } from './governanceRegistry';
import { resolveGovernanceWorkflowConfig } from './governanceWorkflowConfig';
import { resolveEscalationTargets } from './governanceTargetResolution';

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
  (db: DatabaseAdapter, registry: GovernanceRegistry, clock: () => Date = () => new Date()) =>
  async (context: {
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const automaticCases = registry.has(FIELD_DATE_REMINDER_CASE_KIND)
      ? await syncFieldDateReminderCases(db, context.workspace, clock())
      : { created: 0, refreshed: 0, cancelled: 0 };
    const cases = await db.governance.listCases(context.workspace, { status: 'open' });
    const configRows = await db.governanceCaseConfig.listCaseConfig(context.workspace);
    const scanNow = clock();
    let remindersSent = 0;
    let escalationsSent = 0;

    for (const caseRow of cases) {
      if (context.signal?.aborted) break;
      if (!caseRow.due_at) continue;

      const kindConfig = registry.get(caseRow.case_kind);
      const effectiveConfig = resolveGovernanceWorkflowConfig(
        configRows.filter(row => row.case_kind === caseRow.case_kind),
        caseRow.case_subkind,
        kindConfig ? defaultWorkflowConfigForCaseKind(kindConfig) : { extensions: {} },
        kindConfig?.workflowConfig?.supportsWorkspaceScope !== false
      );
      if (!effectiveConfig.enabled) continue;
      const runtimeWindows = kindConfig?.resolveReminderWindows
        ? await kindConfig.resolveReminderWindows(db, caseRow)
        : undefined;
      const codeDefault = kindConfig?.reminders
        ? { enabled: true, ...kindConfig.reminders }
        : undefined;
      const useWorkspaceOverride =
        kindConfig?.workspaceReminderOverrides ?? kindConfig?.resolveReminderWindows == null;
      const reminderConfig = runtimeWindows
        ? { enabled: true, ...runtimeWindows }
        : useWorkspaceOverride
          ? effectiveConfig.config.reminders
          : codeDefault;

      if (reminderConfig?.enabled) {
        const windows = reminderConfig;

        const candidateWindows = computeCandidateReminderWindows(
          caseRow.due_at,
          scanNow,
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

      const escalation = kindConfig?.escalation;
      const escalationConfig = effectiveConfig.config.escalation;
      if (escalation && escalationConfig?.enabled && !caseRow.escalated_at) {
        // Matches computeCandidateReminderWindows's overdue convention exactly (`-daysUntilDue`,
        // not a separately-floored "days overdue"), so a case escalates at the same moment its
        // corresponding overdue reminder window of the same day count would fire.
        const daysUntilDue = Math.floor(
          (caseRow.due_at.getTime() - scanNow.getTime()) / MS_PER_DAY
        );
        const escalationOverdueDays = escalationConfig.overdueDays;
        if (-daysUntilDue >= escalationOverdueDays) {
          await db.core.transaction(async tx => {
            const fresh = await tx.governance.getCase(context.workspace, caseRow.id);
            if (fresh?.status !== 'open' || fresh.escalated_at) return;
            const resolved = await escalation.target(tx, fresh, escalationConfig);
            const strategyTargets =
              resolved == null ? [] : Array.isArray(resolved) ? resolved : [resolved];
            const targets = await resolveEscalationTargets(
              tx,
              context.workspace,
              strategyTargets,
              escalationConfig
            );
            if (targets.length === 0) return;
            await recordGovernanceEvent(tx, fresh, {
              eventType: 'escalated',
              actorUserId: GOVERNANCE_DEADLINE_SCAN_SYSTEM_USER_ID,
              previousStatus: fresh.status,
              resultingStatus: fresh.status,
              reason: null,
              metadata: { trigger: 'scheduled', targets }
            });
            await tx.governance.markEscalated(fresh.id, scanNow);
          });
          escalationsSent += 1;
        }
      }
    }

    const result = { scanned: cases.length, remindersSent, escalationsSent };
    return registry.has(FIELD_DATE_REMINDER_CASE_KIND) ? { ...result, automaticCases } : result;
  };
