import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { governanceReminderConfigContract } from '@arch-register/api-types/governanceReminderConfigContract';
import type { GovernanceReminderConfig } from '@arch-register/api-types/governanceReminderConfigContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type { GovernanceRegistry } from './governanceRegistry';

// Human-readable labels for the case kinds that support scheduled reminders — kept local to this
// settings surface rather than in governanceRegistry.ts, since the registry itself only carries
// domain-effect hooks, not presentation concerns.
const CASE_KIND_LABELS: Record<string, string> = {
  'entity.change-case': 'Entity change proposals',
  'entity.change-case.bulk': 'Bulk entity change proposals',
  'entity.deprecation': 'Entity deprecations',
  'assessment.response': 'Assessment responses'
};

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const reminderConfigRouter = implement(governanceReminderConfigContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const createGovernanceReminderConfigORPCRouter = (registry: GovernanceRegistry) =>
  reminderConfigRouter.router({
    governanceReminderConfig: {
      list: reminderConfigRouter.governanceReminderConfig.list.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.settings');

        const overrides = await context.db.governanceReminderConfig.listReminderConfig(workspace);
        const overrideByKind = new Map(overrides.map(o => [o.case_kind, o]));

        const results: GovernanceReminderConfig[] = [];
        for (const [caseKind, config] of registry) {
          const codeDefault = config.reminderWindows;
          if (!codeDefault) continue;
          const override = overrideByKind.get(caseKind);
          results.push({
            case_kind: caseKind,
            case_kind_label: CASE_KIND_LABELS[caseKind] ?? caseKind,
            enabled: override?.enabled ?? true,
            approaching_days: override?.approaching_days ?? codeDefault.approachingDays,
            overdue_days: override?.overdue_days ?? codeDefault.overdueDays,
            is_default: override == null
          });
        }
        return results;
      }),

      update: reminderConfigRouter.governanceReminderConfig.update.handler(
        async ({ input, context }) => {
          const { workspace, authCtx } = context;
          requireWorkspaceCapability(authCtx, 'ws.settings');
          const { caseKind } = input.params;

          const codeDefault = registry.get(caseKind)?.reminderWindows;
          httpAssert.present(codeDefault, {
            status: 404,
            message: `Case kind '${caseKind}' does not support scheduled reminders`
          });

          const updated = await context.db.governanceReminderConfig.upsertReminderConfig({
            workspace,
            case_kind: caseKind,
            enabled: input.body.enabled,
            approaching_days: input.body.approaching_days,
            overdue_days: input.body.overdue_days,
            updated_at: new Date(),
            updated_by: context.event.context.user.id
          });

          return {
            case_kind: updated.case_kind,
            case_kind_label: CASE_KIND_LABELS[updated.case_kind] ?? updated.case_kind,
            enabled: updated.enabled,
            approaching_days: updated.approaching_days,
            overdue_days: updated.overdue_days,
            is_default: false
          };
        }
      )
    }
  });

export const createGovernanceReminderConfigORPCHandler = (
  db: DatabaseAdapter,
  registry: GovernanceRegistry
) => {
  const handler = new OpenAPIHandler(createGovernanceReminderConfigORPCRouter(registry), {
    clientInterceptors: orpcErrorInterceptors
  });

  return defineHandler(async event => {
    const result = await handler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
