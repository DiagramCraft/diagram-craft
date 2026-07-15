import { randomUUID } from 'node:crypto';
import type { PostgresSqlClient } from '../../../db/postgresBase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { dueJobOccurrences } from '../jobRecurrence';
import { nextJobOccurrence } from '../jobRecurrence';
import { retryDelayMs } from '../jobRetry';
import type {
  JobDatabase,
  JobRunClaim,
  JobRunCompletion,
  JobRunFailure,
  JobRunRetry,
  OneOffJobRunDbCreate,
  JobServerDbRegistration,
  JobScheduleDbCreate,
  JobScheduleDbUpdate,
  JobRunListOptions
} from '../jobsDatabase';
import { jobMappers } from '../jobsDatabase';

export class PostgresJobDatabase extends PostgresDatabaseBase implements JobDatabase {
  async registerServer(input: JobServerDbRegistration) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO job_server (id, name, instance_id, status, last_seen_at)
        VALUES (${input.id}, ${input.name}, ${input.instance_id}, ${input.status}, ${input.last_seen_at})
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            instance_id = EXCLUDED.instance_id,
            status = EXCLUDED.status,
            last_seen_at = EXCLUDED.last_seen_at
        RETURNING *
      `;
      return jobMappers.server(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async heartbeatServer(id: string, instanceId: string, lastSeenAt: Date) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE job_server
        SET status = 'available', last_seen_at = ${lastSeenAt}
        WHERE id = ${id} AND instance_id = ${instanceId}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markServerUnavailable(id: string, instanceId: string, lastSeenAt: Date) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE job_server
        SET status = 'unavailable', last_seen_at = ${lastSeenAt}
        WHERE id = ${id} AND instance_id = ${instanceId}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listServers() {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM job_server ORDER BY name, id
    `;
    return mapDatabaseRows(rows, jobMappers.server);
  }

  private readonly mapSchedule = jobMappers.schedule;
  private readonly mapRun = jobMappers.run;

  async createSchedule(input: JobScheduleDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO job_schedule (
          id, workspace, job_type, system_identity, payload, priority, recurrence,
          enabled, next_occurrence_at, created_at, updated_at
        ) VALUES (
          ${input.id}, ${input.workspace}, ${input.job_type}, ${input.system_identity},
          ${this.json(input.payload)}, ${input.priority}, ${this.json(input.recurrence)},
          ${input.enabled}, ${input.next_occurrence_at}, ${input.created_at}, ${input.updated_at}
        )
        RETURNING *
      `;
      return this.mapSchedule(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateSchedule(id: string, input: JobScheduleDbUpdate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE job_schedule
        SET job_type = ${input.job_type},
            system_identity = ${input.system_identity},
            payload = ${this.json(input.payload)},
            priority = ${input.priority},
            recurrence = ${this.json(input.recurrence)},
            enabled = ${input.enabled},
            next_occurrence_at = ${input.next_occurrence_at},
            updated_at = ${input.updated_at}
        WHERE id = ${id}
        RETURNING *
      `;
      return row ? this.mapSchedule(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getSchedule(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM job_schedule WHERE id = ${id}
    `;
    return row ? this.mapSchedule(row) : null;
  }

  async listSchedules(workspace?: string) {
    const rows = workspace
      ? await this.sql<DatabaseRow[]>`
          SELECT * FROM job_schedule
          WHERE workspace = ${workspace}
          ORDER BY created_at, id
        `
      : await this.sql<DatabaseRow[]>`
          SELECT * FROM job_schedule ORDER BY created_at, id
        `;
    return mapDatabaseRows(rows, this.mapSchedule);
  }

  async listRuns(workspace: string, options: JobRunListOptions) {
    const conditions = ['workspace = $1'];
    const params: unknown[] = [workspace];

    if (options.scheduleId) {
      params.push(options.scheduleId);
      conditions.push(`schedule_id = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options.plannedFrom) {
      params.push(options.plannedFrom);
      conditions.push(`planned_at >= $${params.length}`);
    }
    if (options.plannedTo) {
      params.push(options.plannedTo);
      conditions.push(`planned_at <= $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const countRows = await this.sql.unsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM job_run WHERE ${where}`,
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    const pageParams = [...params, options.limit, options.offset];
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `SELECT * FROM job_run
       WHERE ${where}
       ORDER BY planned_at DESC, created_at DESC, id DESC
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams as Parameters<typeof this.sql.unsafe>[1]
    );

    return {
      items: mapDatabaseRows(rows, this.mapRun),
      total: Number(countRows[0]?.count ?? 0)
    };
  }

  async getRun(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM job_run WHERE id = ${id}
    `;
    return row ? this.mapRun(row) : null;
  }

  async cancelQueuedRun(workspace: string, id: string, completedAt: Date) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE job_run
        SET status = 'cancelled', completed_at = ${completedAt}
        WHERE workspace = ${workspace} AND id = ${id} AND status = 'queued'
        RETURNING *
      `;
      return row ? this.mapRun(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async materializeDueSchedules(now: Date) {
    try {
      return await this.sql.begin(async transaction => {
        const sql = transaction as unknown as PostgresSqlClient;
        const schedules = await sql<DatabaseRow[]>`
          SELECT * FROM job_schedule
          WHERE enabled = TRUE AND next_occurrence_at <= ${now}
          ORDER BY next_occurrence_at, created_at, id
          FOR UPDATE SKIP LOCKED
        `;
        let created = 0;

        for (const row of schedules) {
          const schedule = this.mapSchedule(row);
          const due = dueJobOccurrences(schedule.recurrence, schedule.next_occurrence_at, now);
          if (!due) continue;

          const runId = randomUUID();
          const inserted = await sql<DatabaseRow[]>`
            INSERT INTO job_run (
              id, schedule_id, workspace, job_type, system_identity, payload, priority,
              occurrence_at, coalesced_through_at, coalesced_count, planned_at, created_at, status
            ) VALUES (
              ${runId}, ${schedule.id}, ${schedule.workspace}, ${schedule.job_type},
              ${schedule.system_identity}, ${sql.json(schedule.payload as Parameters<PostgresSqlClient['json']>[0])}, ${schedule.priority},
              ${due.first}, ${due.last}, ${due.count}, ${due.first}, ${now}, 'queued'
            )
            ON CONFLICT (schedule_id, occurrence_at) DO NOTHING
            RETURNING id
          `;

          await sql`
            UPDATE job_schedule
            SET next_occurrence_at = ${due.next}, updated_at = ${now}
            WHERE id = ${schedule.id}
          `;
          created += inserted.length;
        }

        return created;
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async enqueueRun(scheduleId: string, now: Date) {
    const [existing] = await this.sql<DatabaseRow[]>`
      SELECT * FROM job_run
      WHERE schedule_id = ${scheduleId} AND status IN ('queued', 'running')
      ORDER BY created_at LIMIT 1
    `;
    if (existing) return this.mapRun(existing);
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule?.enabled) return null;
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO job_run (
          id, schedule_id, workspace, job_type, system_identity, payload, priority,
          occurrence_at, coalesced_through_at, coalesced_count, planned_at, created_at, status
        ) VALUES (
          ${randomUUID()}, ${schedule.id}, ${schedule.workspace}, ${schedule.job_type},
          ${schedule.system_identity}, ${this.json(schedule.payload)}, ${schedule.priority},
          ${now}, ${now}, 1, ${now}, ${now}, 'queued'
        ) RETURNING *
      `;
      if (schedule.next_occurrence_at <= now) {
        await this.sql`
          UPDATE job_schedule
          SET next_occurrence_at = ${nextJobOccurrence(schedule.recurrence, new Date(now.getTime() + 1))},
              updated_at = ${now}
          WHERE id = ${schedule.id}
        `;
      }
      return row ? this.mapRun(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async enqueueOneOffRun(input: OneOffJobRunDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO job_run (
          id, schedule_id, workspace, job_type, system_identity, payload, priority,
          occurrence_at, coalesced_through_at, coalesced_count, planned_at, created_at,
          status, max_attempts
        ) VALUES (
          ${input.id}, NULL, ${input.workspace}, ${input.job_type}, ${input.system_identity},
          ${this.json(input.payload)}, ${input.priority}, ${input.created_at}, ${input.created_at},
          1, ${input.planned_at}, ${input.created_at}, 'queued', ${input.max_attempts}
        ) RETURNING *
      `;
      return this.mapRun(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async recoverExpiredRuns(now: Date) {
    try {
      return await this.sql.begin(async transaction => {
        const sql = transaction as unknown as PostgresSqlClient;
        const stale = await sql<
          {
            id: string;
            lease_token: string;
            attempt_count: number;
            max_attempts: number;
          }[]
        >`
          SELECT r.id, r.lease_token, r.attempt_count, r.max_attempts
          FROM job_run r
          JOIN job_workspace_lease l ON l.run_id = r.id
          WHERE r.status = 'running' AND l.expires_at <= ${now}
          FOR UPDATE OF r, l SKIP LOCKED
        `;
        for (const run of stale) {
          const retry = run.attempt_count < run.max_attempts;
          const retryAt = new Date(now.getTime() + retryDelayMs(run.attempt_count));
          await sql`
            UPDATE job_run
            SET status = ${retry ? 'queued' : 'failed'},
                completed_at = ${retry ? null : now},
                planned_at = ${retry ? retryAt : now},
                started_at = NULL, worker_id = NULL, lease_token = NULL,
                error = 'Worker lease expired'
            WHERE id = ${run.id} AND status = 'running' AND lease_token = ${run.lease_token}
          `;
          await sql`
            DELETE FROM job_workspace_lease
            WHERE run_id = ${run.id} AND lease_token = ${run.lease_token}
          `;
        }
        return stale.length;
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async claimNextRun(
    workerId: string,
    leaseDurationMs: number,
    now: Date
  ): Promise<JobRunClaim | null> {
    try {
      return await this.sql.begin(async transaction => {
        const sql = transaction as unknown as PostgresSqlClient;
        const candidates = await sql<DatabaseRow[]>`
          SELECT r.*
          FROM job_run r
          WHERE r.status = 'queued'
            AND r.planned_at <= ${now}
            AND NOT EXISTS (
              SELECT 1 FROM job_workspace_lease l
              WHERE l.workspace = r.workspace AND l.expires_at > ${now}
            )
          ORDER BY r.priority, r.planned_at, r.created_at, r.id
          LIMIT 50
          FOR UPDATE OF r SKIP LOCKED
        `;

        for (const candidate of candidates) {
          const token = randomUUID();
          const expiresAt = new Date(now.getTime() + leaseDurationMs);
          const lease = await sql<{ workspace: string }[]>`
            INSERT INTO job_workspace_lease (
              workspace, run_id, worker_id, lease_token, acquired_at, heartbeat_at, expires_at
            ) VALUES (
              ${String(candidate['workspace'])}, ${String(candidate['id'])}, ${workerId},
              ${token}, ${now}, ${now}, ${expiresAt}
            )
            ON CONFLICT (workspace) DO UPDATE
            SET run_id = EXCLUDED.run_id,
                worker_id = EXCLUDED.worker_id,
                lease_token = EXCLUDED.lease_token,
                acquired_at = EXCLUDED.acquired_at,
                heartbeat_at = EXCLUDED.heartbeat_at,
                expires_at = EXCLUDED.expires_at
            WHERE job_workspace_lease.expires_at <= ${now}
            RETURNING workspace
          `;
          if (lease.length === 0) continue;

          const [row] = await sql<DatabaseRow[]>`
            UPDATE job_run
            SET status = 'running', started_at = ${now}, worker_id = ${workerId},
                lease_token = ${token}, attempt_count = attempt_count + 1
            WHERE id = ${String(candidate['id'])} AND status = 'queued'
            RETURNING *
          `;
          if (!row) {
            await sql`DELETE FROM job_workspace_lease WHERE lease_token = ${token}`;
            continue;
          }
          return { run: this.mapRun(row), leaseToken: token };
        }

        return null;
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async heartbeatRun(
    runId: string,
    workerId: string,
    leaseToken: string,
    heartbeatAt: Date,
    leaseExpiresAt: Date
  ) {
    try {
      const rows = await this.sql<{ workspace: string }[]>`
        UPDATE job_workspace_lease l
        SET heartbeat_at = ${heartbeatAt}, expires_at = ${leaseExpiresAt}
        FROM job_run r
        WHERE l.run_id = r.id
          AND r.id = ${runId}
          AND r.status = 'running'
          AND r.worker_id = ${workerId}
          AND r.lease_token = ${leaseToken}
          AND l.worker_id = ${workerId}
          AND l.lease_token = ${leaseToken}
          AND l.expires_at > ${heartbeatAt}
        RETURNING l.workspace
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async completeRun(input: JobRunCompletion) {
    try {
      return await this.sql.begin(async transaction => {
        const sql = transaction as unknown as PostgresSqlClient;
        const [row] = await sql<DatabaseRow[]>`
          UPDATE job_run r
          SET status = 'succeeded', completed_at = ${input.completedAt},
              result = ${input.result == null ? null : sql.json(input.result as Parameters<PostgresSqlClient['json']>[0])}, lease_token = NULL
          WHERE r.id = ${input.runId}
            AND r.status = 'running'
            AND r.worker_id = ${input.workerId}
            AND r.lease_token = ${input.leaseToken}
            AND EXISTS (
              SELECT 1 FROM job_workspace_lease l
              WHERE l.run_id = r.id AND l.worker_id = ${input.workerId}
                AND l.lease_token = ${input.leaseToken}
                AND l.expires_at > ${input.completedAt}
            )
          RETURNING r.*
        `;
        if (!row) return false;
        await sql`
          DELETE FROM job_workspace_lease
          WHERE run_id = ${input.runId} AND worker_id = ${input.workerId}
            AND lease_token = ${input.leaseToken}
        `;
        return true;
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async failRun(input: JobRunFailure) {
    try {
      return await this.sql.begin(async transaction => {
        const sql = transaction as unknown as PostgresSqlClient;
        const [row] = await sql<DatabaseRow[]>`
          UPDATE job_run r
          SET status = 'failed', completed_at = ${input.completedAt},
              error = ${input.error}, lease_token = NULL
          WHERE r.id = ${input.runId}
            AND r.status = 'running'
            AND r.worker_id = ${input.workerId}
            AND r.lease_token = ${input.leaseToken}
            AND EXISTS (
              SELECT 1 FROM job_workspace_lease l
              WHERE l.run_id = r.id AND l.worker_id = ${input.workerId}
                AND l.lease_token = ${input.leaseToken}
                AND l.expires_at > ${input.completedAt}
            )
          RETURNING r.*
        `;
        if (!row) return false;
        await sql`
          DELETE FROM job_workspace_lease
          WHERE run_id = ${input.runId} AND worker_id = ${input.workerId}
            AND lease_token = ${input.leaseToken}
        `;
        return true;
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async retryRun(input: JobRunRetry) {
    try {
      return await this.sql.begin(async transaction => {
        const sql = transaction as unknown as PostgresSqlClient;
        const [row] = await sql<DatabaseRow[]>`
          UPDATE job_run r
          SET status = 'queued', planned_at = ${input.retryAt}, started_at = NULL,
              completed_at = NULL, worker_id = NULL, lease_token = NULL, error = ${input.error}
          WHERE r.id = ${input.runId}
            AND r.status = 'running'
            AND r.worker_id = ${input.workerId}
            AND r.lease_token = ${input.leaseToken}
            AND r.attempt_count < r.max_attempts
            AND EXISTS (
              SELECT 1 FROM job_workspace_lease l
              WHERE l.run_id = r.id AND l.worker_id = ${input.workerId}
                AND l.lease_token = ${input.leaseToken}
            )
          RETURNING r.*
        `;
        if (!row) return false;
        await sql`
          DELETE FROM job_workspace_lease
          WHERE run_id = ${input.runId} AND worker_id = ${input.workerId}
            AND lease_token = ${input.leaseToken}
        `;
        return true;
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
