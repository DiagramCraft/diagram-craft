import { implement } from '@orpc/server';
import { conformanceContract } from '@arch-register/api-types/conformanceContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import {
  createConformanceCheck,
  deleteConformanceCheck,
  exemptConformanceViolation,
  getConformanceSummary,
  listConformanceChecks,
  listConformanceRuns,
  listConformanceViolationEvents,
  listConformanceViolations,
  revokeConformanceExemption,
  setConformanceViolationStatus,
  startConformanceRun,
  updateConformanceCheck
} from './conformanceOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const conformanceRouter = implement(conformanceContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const conformanceORPCRouter = conformanceRouter.router({
  conformance: {
    checks: {
      list: conformanceRouter.conformance.checks.list.handler(({ context }) =>
        listConformanceChecks(context.db, context.workspace, context.authCtx)
      ),
      create: conformanceRouter.conformance.checks.create.handler(({ input, context }) =>
        createConformanceCheck(
          context.db,
          context.workspace,
          input.body,
          context.authCtx,
          context.event
        )
      ),
      update: conformanceRouter.conformance.checks.update.handler(({ input, context }) =>
        updateConformanceCheck(
          context.db,
          context.workspace,
          input.params.id,
          input.body,
          context.authCtx
        )
      ),
      remove: conformanceRouter.conformance.checks.remove.handler(({ input, context }) =>
        deleteConformanceCheck(context.db, context.workspace, input.params.id, context.authCtx)
      )
    },
    runs: {
      list: conformanceRouter.conformance.runs.list.handler(({ context }) =>
        listConformanceRuns(context.db, context.workspace, context.authCtx)
      ),
      start: conformanceRouter.conformance.runs.start.handler(({ input, context }) =>
        startConformanceRun(context.db, context.workspace, input.body.checkId, context.authCtx)
      )
    },
    violations: {
      list: conformanceRouter.conformance.violations.list.handler(({ input, context }) =>
        listConformanceViolations(context.db, context.workspace, input.query, context.event)
      ),
      exempt: conformanceRouter.conformance.violations.exempt.handler(({ input, context }) =>
        exemptConformanceViolation(
          context.db,
          context.workspace,
          input.params.id,
          input.body,
          context.authCtx,
          context.event
        )
      ),
      revokeExemption: conformanceRouter.conformance.violations.revokeExemption.handler(
        ({ input, context }) =>
          revokeConformanceExemption(
            context.db,
            context.workspace,
            input.params.id,
            context.authCtx
          )
      ),
      setStatus: conformanceRouter.conformance.violations.setStatus.handler(({ input, context }) =>
        setConformanceViolationStatus(
          context.db,
          context.workspace,
          input.params.id,
          input.body.status,
          context.authCtx
        )
      ),
      events: conformanceRouter.conformance.violations.events.handler(({ input, context }) =>
        listConformanceViolationEvents(
          context.db,
          context.workspace,
          input.params.id,
          context.event
        )
      )
    },
    summary: conformanceRouter.conformance.summary.handler(({ context }) =>
      getConformanceSummary(context.db, context.workspace, context.authCtx, context.event)
    )
  }
});

export const createConformanceORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(conformanceORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
