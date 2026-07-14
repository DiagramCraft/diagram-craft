import { randomUUID } from 'node:crypto';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import { dueJobOccurrences } from '../jobRecurrence';
import type {
  JobDatabase,
  JobRunClaim,
  JobRunCompletion,
  JobRunFailure,
  JobScheduleDbCreate,
  JobScheduleDbUpdate,
  JobRunDbResult,
  JobRunListOptions
} from '../jobsDatabase';
import { jobMappers } from '../jobsDatabase';

const iso = (date: Date) => date.toISOString();

export class SqliteJobDatabase extends SqliteDatabaseBase implements JobDatabase {
  async createSchedule(input: JobScheduleDbCreate) {
    this.run(
      `INSERT INTO job_schedule (
        id, workspace, job_type, system_identity, payload, priority, recurrence,
        enabled, next_occurrence_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.job_type,
        input.system_identity,
        JSON.stringify(input.payload),
        input.priority,
        JSON.stringify({
          ...input.recurrence,
          ...(input.recurrence.type === 'hours' ? { startsAt: iso(input.recurrence.startsAt) } : {})
        }),
        input.enabled ? 1 : 0,
        iso(input.next_occurrence_at),
        iso(input.created_at),
        iso(input.updated_at)
      ]
    );
    return (await this.get(
      'SELECT * FROM job_schedule WHERE id = ?',
      [input.id],
      jobMappers.schedule
    ))!;
  }

  async updateSchedule(id: string, input: JobScheduleDbUpdate) {
    this.run(
      `UPDATE job_schedule
       SET job_type = ?, system_identity = ?, payload = ?, priority = ?, recurrence = ?,
           enabled = ?, next_occurrence_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.job_type,
        input.system_identity,
        JSON.stringify(input.payload),
        input.priority,
        JSON.stringify({
          ...input.recurrence,
          ...(input.recurrence.type === 'hours' ? { startsAt: iso(input.recurrence.startsAt) } : {})
        }),
        input.enabled ? 1 : 0,
        iso(input.next_occurrence_at),
        iso(input.updated_at),
        id
      ]
    );
    return await this.get('SELECT * FROM job_schedule WHERE id = ?', [id], jobMappers.schedule);
  }

  async getSchedule(id: string) {
    return await this.get('SELECT * FROM job_schedule WHERE id = ?', [id], jobMappers.schedule);
  }

  async listSchedules(workspace?: string) {
    return workspace
      ? this.all(
          'SELECT * FROM job_schedule WHERE workspace = ? ORDER BY created_at, id',
          [workspace],
          jobMappers.schedule
        )
      : this.all('SELECT * FROM job_schedule ORDER BY created_at, id', [], jobMappers.schedule);
  }

  async listRuns(workspace: string, options: JobRunListOptions) {
    const conditions = ['workspace = ?'];
    const params: unknown[] = [workspace];

    if (options.scheduleId) {
      conditions.push('schedule_id = ?');
      params.push(options.scheduleId);
    }
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options.plannedFrom) {
      conditions.push('planned_at >= ?');
      params.push(iso(options.plannedFrom));
    }
    if (options.plannedTo) {
      conditions.push('planned_at <= ?');
      params.push(iso(options.plannedTo));
    }

    const where = conditions.join(' AND ');
    const totalRow = this.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM job_run WHERE ${where}`,
      params
    );
    const items = this.all(
      `SELECT * FROM job_run
       WHERE ${where}
       ORDER BY planned_at DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, options.limit, options.offset],
      jobMappers.run
    );

    return { items, total: Number(totalRow?.count ?? 0) };
  }

  async getRun(id: string) {
    return await this.get('SELECT * FROM job_run WHERE id = ?', [id], jobMappers.run);
  }

  async cancelQueuedRun(workspace: string, id: string, completedAt: Date) {
    const result = this.run(
      "UPDATE job_run SET status = 'cancelled', completed_at = ? WHERE workspace = ? AND id = ? AND status = 'queued'",
      [iso(completedAt), workspace, id]
    );
    if (result.changes === 0) return null;
    return await this.get('SELECT * FROM job_run WHERE id = ?', [id], jobMappers.run);
  }

  async materializeDueSchedules(now: Date) {
    const transaction = this.db.transaction(() => {
      const schedules = this.all(
        `SELECT * FROM job_schedule
         WHERE enabled = 1 AND next_occurrence_at <= ?
         ORDER BY next_occurrence_at, created_at, id`,
        [iso(now)],
        jobMappers.schedule
      );
      let created = 0;
      for (const schedule of schedules) {
        const due = dueJobOccurrences(schedule.recurrence, schedule.next_occurrence_at, now);
        if (!due) continue;
        const result = this.run(
          `INSERT OR IGNORE INTO job_run (
            id, schedule_id, workspace, job_type, system_identity, payload, priority,
            occurrence_at, coalesced_through_at, coalesced_count, planned_at, created_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')`,
          [
            randomUUID(),
            schedule.id,
            schedule.workspace,
            schedule.job_type,
            schedule.system_identity,
            JSON.stringify(schedule.payload),
            schedule.priority,
            iso(due.first),
            iso(due.last),
            due.count,
            iso(due.first),
            iso(now)
          ]
        );
        this.run('UPDATE job_schedule SET next_occurrence_at = ?, updated_at = ? WHERE id = ?', [
          iso(due.next),
          iso(now),
          schedule.id
        ]);
        created += result.changes;
      }
      return created;
    });
    return transaction();
  }

  async recoverExpiredRuns(now: Date) {
    const transaction = this.db.transaction(() => {
      const stale = this.all<{ id: string; lease_token: string }>(
        `SELECT r.id, r.lease_token
         FROM job_run r JOIN job_workspace_lease l ON l.run_id = r.id
         WHERE r.status = 'running' AND l.expires_at <= ?`,
        [iso(now)]
      );
      for (const run of stale) {
        this.run(
          `UPDATE job_run
           SET status = 'failed', completed_at = ?, lease_token = NULL, error = ?
           WHERE id = ? AND status = 'running' AND lease_token = ?`,
          [iso(now), 'Worker lease expired', run.id, run.lease_token]
        );
        this.run('DELETE FROM job_workspace_lease WHERE run_id = ? AND lease_token = ?', [
          run.id,
          run.lease_token
        ]);
      }
      return stale.length;
    });
    return transaction();
  }

  async claimNextRun(
    workerId: string,
    leaseDurationMs: number,
    now: Date
  ): Promise<JobRunClaim | null> {
    const transaction = this.db.transaction(() => {
      const candidates = this.all<JobRunDbResult>(
        `SELECT r.*
         FROM job_run r
         WHERE r.status = 'queued' AND r.planned_at <= ?
           AND NOT EXISTS (
             SELECT 1 FROM job_workspace_lease l
             WHERE l.workspace = r.workspace
           )
         ORDER BY r.priority, r.planned_at, r.created_at, r.id
         LIMIT 50`,
        [iso(now)],
        jobMappers.run
      );

      for (const candidate of candidates) {
        const current = this.get(
          "SELECT * FROM job_run WHERE id = ? AND status = 'queued'",
          [candidate.id],
          jobMappers.run
        );
        if (!current) continue;
        const token = randomUUID();
        const expiresAt = new Date(now.getTime() + leaseDurationMs);
        const existingLease = this.get<{ expires_at: string }>(
          'SELECT expires_at FROM job_workspace_lease WHERE workspace = ?',
          [candidate.workspace]
        );
        if (existingLease) continue;
        const lease = this.run(
          `INSERT INTO job_workspace_lease (
            workspace, run_id, worker_id, lease_token, acquired_at, heartbeat_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [current.workspace, current.id, workerId, token, iso(now), iso(now), iso(expiresAt)]
        );
        if (lease.changes === 0) continue;

        const updated = this.run(
          `UPDATE job_run
           SET status = 'running', started_at = ?, worker_id = ?, lease_token = ?
           WHERE id = ? AND status = 'queued'`,
          [iso(now), workerId, token, current.id]
        );
        if (updated.changes === 0) {
          this.run('DELETE FROM job_workspace_lease WHERE lease_token = ?', [token]);
          continue;
        }
        const run = this.get('SELECT * FROM job_run WHERE id = ?', [current.id], jobMappers.run)!;
        return { run, leaseToken: token };
      }
      return null;
    });
    return transaction();
  }

  async heartbeatRun(
    runId: string,
    workerId: string,
    leaseToken: string,
    heartbeatAt: Date,
    leaseExpiresAt: Date
  ) {
    const result = this.run(
      `UPDATE job_workspace_lease
       SET heartbeat_at = ?, expires_at = ?
       WHERE run_id = ? AND worker_id = ? AND lease_token = ? AND expires_at > ?
         AND EXISTS (
           SELECT 1 FROM job_run r
           WHERE r.id = ? AND r.status = 'running' AND r.worker_id = ? AND r.lease_token = ?
         )`,
      [
        iso(heartbeatAt),
        iso(leaseExpiresAt),
        runId,
        workerId,
        leaseToken,
        iso(heartbeatAt),
        runId,
        workerId,
        leaseToken
      ]
    );
    return result.changes > 0;
  }

  async completeRun(input: JobRunCompletion) {
    const transaction = this.db.transaction(() => {
      const result = this.run(
        `UPDATE job_run
         SET status = 'succeeded', completed_at = ?, result = ?, lease_token = NULL
         WHERE id = ? AND status = 'running' AND worker_id = ? AND lease_token = ?
           AND EXISTS (
             SELECT 1 FROM job_workspace_lease l
             WHERE l.run_id = job_run.id AND l.worker_id = ? AND l.lease_token = ?
               AND l.expires_at > ?
           )`,
        [
          input.completedAt.toISOString(),
          input.result == null ? null : JSON.stringify(input.result),
          input.runId,
          input.workerId,
          input.leaseToken,
          input.workerId,
          input.leaseToken,
          input.completedAt.toISOString()
        ]
      );
      if (result.changes === 0) return false;
      this.run(
        'DELETE FROM job_workspace_lease WHERE run_id = ? AND worker_id = ? AND lease_token = ?',
        [input.runId, input.workerId, input.leaseToken]
      );
      return true;
    });
    return transaction();
  }

  async failRun(input: JobRunFailure) {
    const transaction = this.db.transaction(() => {
      const result = this.run(
        `UPDATE job_run
         SET status = 'failed', completed_at = ?, error = ?, lease_token = NULL
         WHERE id = ? AND status = 'running' AND worker_id = ? AND lease_token = ?
           AND EXISTS (
             SELECT 1 FROM job_workspace_lease l
             WHERE l.run_id = job_run.id AND l.worker_id = ? AND l.lease_token = ?
               AND l.expires_at > ?
           )`,
        [
          input.completedAt.toISOString(),
          input.error,
          input.runId,
          input.workerId,
          input.leaseToken,
          input.workerId,
          input.leaseToken,
          input.completedAt.toISOString()
        ]
      );
      if (result.changes === 0) return false;
      this.run(
        'DELETE FROM job_workspace_lease WHERE run_id = ? AND worker_id = ? AND lease_token = ?',
        [input.runId, input.workerId, input.leaseToken]
      );
      return true;
    });
    return transaction();
  }
}
