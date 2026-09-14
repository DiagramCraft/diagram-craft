import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import type { DatabaseAdapter } from '../database';
import {
  createFixtureProject,
  createFixtureWorkspace,
  createFullFixtureSet
} from '../testSupport/fixtures';
import {
  ASSESSMENT_RECURRENCE_JOB_TYPE,
  ASSESSMENT_RECURRENCE_SYSTEM_IDENTITY,
  createAssessmentRecurrenceJobHandler
} from '../../domain/project/assessmentRecurrenceJob';

const now = new Date('2026-06-01T12:00:00.000Z');

const createPendingAssessment = async (
  db: DatabaseAdapter,
  options: { assignedTeamIds?: string[] } = {}
) => {
  const { workspace, project } = await createFullFixtureSet(db);
  const assessmentId = randomUUID();
  const pendingJobId = randomUUID();

  await db.jobs.enqueueOneOffRun({
    id: pendingJobId,
    workspace,
    job_type: ASSESSMENT_RECURRENCE_JOB_TYPE,
    system_identity: ASSESSMENT_RECURRENCE_SYSTEM_IDENTITY,
    payload: { assessmentId },
    priority: 5,
    planned_at: now,
    created_at: now,
    max_attempts: 1,
    dedupe_key: null
  });

  const assessment = await db.project.assessments.createAssessment({
    id: assessmentId,
    workspace,
    project_id: project,
    name: `Recurring assessment ${assessmentId}`,
    description: '',
    status: 'open',
    mode: 'confirm',
    scope: [],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: options.assignedTeamIds ?? [],
    due_at: now,
    recurrence: { type: 'weekly', intervalWeeks: 1 },
    response_window_days: 7,
    current_occurrence: 1,
    pending_occurrence_job_run_id: pendingJobId,
    next_occurrence_at: now,
    created_at: now,
    updated_at: now
  });

  return { workspace, project, assessment, pendingJobId };
};

const handlerContext = (workspace: string, assessmentId: string, jobId: string) => ({
  jobId,
  workspace,
  payload: { assessmentId },
  signal: new AbortController().signal
});

const listAssessmentRuns = async (db: DatabaseAdapter, workspace: string) =>
  (
    await db.jobs.listRuns(workspace, {
      jobType: ASSESSMENT_RECURRENCE_JOB_TYPE,
      limit: 100,
      offset: 0
    })
  ).items;

runContractSuiteAgainstBothDrivers('Assessment recurrence idempotency', getDb => {
  it('consumes only the matching pending job run ID', async () => {
    const db = getDb();
    const { workspace, assessment, pendingJobId } = await createPendingAssessment(db);

    expect(
      await db.project.assessments.consumePendingOccurrenceJobRun(
        workspace,
        assessment.id,
        randomUUID()
      )
    ).toBeNull();
    expect(
      (await db.project.assessments.getAssessmentById(workspace, assessment.id))!
        .pending_occurrence_job_run_id
    ).toBe(pendingJobId);

    const consumed = await db.project.assessments.consumePendingOccurrenceJobRun(
      workspace,
      assessment.id,
      pendingJobId
    );
    expect(consumed).not.toBeNull();
    expect(consumed!.pending_occurrence_job_run_id).toBeNull();
    expect(
      await db.project.assessments.consumePendingOccurrenceJobRun(
        workspace,
        assessment.id,
        pendingJobId
      )
    ).toBeNull();
  });

  it('advances once and creates one successor when the same run is replayed', async () => {
    const db = getDb();
    const { workspace, assessment, pendingJobId } = await createPendingAssessment(db);
    const handler = createAssessmentRecurrenceJobHandler(db);
    const context = handlerContext(workspace, assessment.id, pendingJobId);

    const first = await handler(context);
    const replay = await handler(context);

    expect(first).toMatchObject({ assessmentId: assessment.id, occurrence: 2 });
    expect(replay).toEqual({ skipped: true });

    const stored = (await db.project.assessments.getAssessmentById(workspace, assessment.id))!;
    const runs = await listAssessmentRuns(db, workspace);
    const auditLogs = (await db.audit.listAuditLogs(workspace)).filter(
      log => log.entity_type === 'assessment' && log.entity_id === assessment.id
    );
    const cases = await db.governance.listCases(workspace, { subjectId: assessment.id });

    expect(stored.current_occurrence).toBe(2);
    expect(stored.pending_occurrence_job_run_id).not.toBe(pendingJobId);
    expect(runs).toHaveLength(2);
    expect(auditLogs).toHaveLength(1);
    expect(cases).toHaveLength(0);
  });

  it('skips stale or replaced IDs without side effects', async () => {
    const db = getDb();
    const { workspace, assessment, pendingJobId } = await createPendingAssessment(db);
    const handler = createAssessmentRecurrenceJobHandler(db);

    const result = await handler(handlerContext(workspace, assessment.id, randomUUID()));

    expect(result).toEqual({ skipped: true });
    expect(await db.project.assessments.getAssessmentById(workspace, assessment.id)).toMatchObject({
      current_occurrence: 1,
      pending_occurrence_job_run_id: pendingJobId
    });
    expect(await listAssessmentRuns(db, workspace)).toHaveLength(1);
    expect(await db.audit.listAuditLogs(workspace)).toHaveLength(0);
    expect(await db.governance.listCases(workspace, { subjectId: assessment.id })).toHaveLength(0);
  });

  it('allows only one concurrent execution to apply the transition', async () => {
    const db = getDb();
    const teamId = randomUUID();
    const workspace = await createFixtureWorkspace(db);
    await db.workspace.replaceTeams(workspace, [
      {
        id: teamId,
        workspace,
        name: 'Review team',
        sort_order: 0,
        color: null,
        description: '',
        created_at: now
      }
    ]);
    const project = await createFixtureProject(db, workspace);
    const assessmentId = randomUUID();
    const pendingJobId = randomUUID();
    await db.jobs.enqueueOneOffRun({
      id: pendingJobId,
      workspace,
      job_type: ASSESSMENT_RECURRENCE_JOB_TYPE,
      system_identity: ASSESSMENT_RECURRENCE_SYSTEM_IDENTITY,
      payload: { assessmentId },
      priority: 5,
      planned_at: now,
      created_at: now,
      max_attempts: 1,
      dedupe_key: null
    });
    const assessment = await db.project.assessments.createAssessment({
      id: assessmentId,
      workspace,
      project_id: project.id,
      name: `Concurrent assessment ${assessmentId}`,
      description: '',
      status: 'open',
      mode: 'confirm',
      scope: [],
      scope_conditions: [],
      fields: [],
      groups: [],
      assigned_team_ids: [teamId],
      due_at: now,
      recurrence: { type: 'weekly', intervalWeeks: 1 },
      response_window_days: 7,
      current_occurrence: 1,
      pending_occurrence_job_run_id: pendingJobId,
      next_occurrence_at: now,
      created_at: now,
      updated_at: now
    });
    const handler = createAssessmentRecurrenceJobHandler(db);

    const results = await Promise.all([
      handler(handlerContext(workspace, assessment.id, pendingJobId)),
      handler(handlerContext(workspace, assessment.id, pendingJobId))
    ]);

    expect(results.filter(result => result && !('skipped' in result))).toHaveLength(1);
    expect(results.filter(result => result?.skipped === true)).toHaveLength(1);
    expect(
      (await db.project.assessments.getAssessmentById(workspace, assessment.id))!.current_occurrence
    ).toBe(2);
    expect(await listAssessmentRuns(db, workspace)).toHaveLength(2);
    expect(await db.audit.listAuditLogs(workspace)).toHaveLength(1);
    expect(await db.governance.listCases(workspace, { subjectId: assessment.id })).toHaveLength(1);
  });

  it('rolls back the claim and all recurrence side effects when governance fails', async () => {
    const db = getDb();
    const missingTeamId = randomUUID();
    const { workspace, assessment, pendingJobId } = await createPendingAssessment(db, {
      assignedTeamIds: [missingTeamId]
    });
    const handler = createAssessmentRecurrenceJobHandler(db);

    await expect(handler(handlerContext(workspace, assessment.id, pendingJobId))).rejects.toThrow();

    expect(await db.project.assessments.getAssessmentById(workspace, assessment.id)).toMatchObject({
      current_occurrence: 1,
      pending_occurrence_job_run_id: pendingJobId
    });
    expect(await listAssessmentRuns(db, workspace)).toHaveLength(1);
    expect(await db.audit.listAuditLogs(workspace)).toHaveLength(0);
    expect(await db.governance.listCases(workspace, { subjectId: assessment.id })).toHaveLength(0);
  });
});
