import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { governanceWorkflowOverviewContract } from '@arch-register/api-types/governanceWorkflowOverviewContract';
import type { GovernanceWorkflowOverview } from '@arch-register/api-types/governanceWorkflowOverviewContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { requireWorkspaceCapability } from '../auth/authorization';
import type { GovernanceRegistry } from './governanceRegistry';
import { CASE_KIND_LABELS, CASE_KIND_DESCRIPTIONS } from './governanceCaseKindLabels';
import {
  DOCUMENT_STATUS_CASE_KIND,
  summarizeDocumentStatusApprovals
} from '../document/documentWorkflowOperations';
import { FIELD_DATE_REMINDER_CASE_KIND } from '../catalog/fieldDateReminderJob';

// Case kinds whose configuration lives entirely outside the reminders/escalation/approval
// capabilities modeled here (e.g. per-schema-field settings), so the card should link to that
// settings section instead of claiming nothing is configurable.
const CONFIGURED_ELSEWHERE: Record<string, { settingsSectionId: string; label: string }> = {
  [FIELD_DATE_REMINDER_CASE_KIND]: { settingsSectionId: 'schemas', label: 'Entity Schema' }
};

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const workflowOverviewRouter = implement(governanceWorkflowOverviewContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const createGovernanceWorkflowOverviewORPCRouter = (registry: GovernanceRegistry) =>
  workflowOverviewRouter.router({
    governanceWorkflowOverview: {
      list: workflowOverviewRouter.governanceWorkflowOverview.list.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.settings');

        const documentTypes = await context.db.document.listDocumentTypes(workspace);
        const approvalSummary = summarizeDocumentStatusApprovals(
          documentTypes,
          await context.db.governanceCaseConfig.listCaseConfigForKind(
            workspace,
            DOCUMENT_STATUS_CASE_KIND
          )
        );

        const results: GovernanceWorkflowOverview[] = [];
        for (const [caseKind, config] of registry) {
          const configuredElsewhere = CONFIGURED_ELSEWHERE[caseKind];
          results.push({
            case_kind: caseKind,
            label: CASE_KIND_LABELS[caseKind] ?? caseKind,
            description: CASE_KIND_DESCRIPTIONS[caseKind] ?? '',
            capabilities: {
              // Mirrors governanceReminderConfigOrpc.ts's list handler, which only surfaces case
              // kinds with a static `reminderWindows` default — `resolveReminderWindows` kinds are
              // runtime-driven per subject and have no workspace-configurable cadence to show here.
              reminders: config.reminderWindows != null,
              escalation: config.escalation != null,
              approvalQuorum: caseKind === DOCUMENT_STATUS_CASE_KIND
            },
            approval_summary: caseKind === DOCUMENT_STATUS_CASE_KIND ? approvalSummary : undefined,
            configured_elsewhere: configuredElsewhere
              ? {
                  settings_section_id: configuredElsewhere.settingsSectionId,
                  settings_section_label: configuredElsewhere.label
                }
              : undefined
          });
        }
        return results;
      })
    }
  });

export const createGovernanceWorkflowOverviewORPCHandler = (
  db: DatabaseAdapter,
  registry: GovernanceRegistry
) => {
  const handler = new OpenAPIHandler(createGovernanceWorkflowOverviewORPCRouter(registry), {
    clientInterceptors: orpcErrorInterceptors
  });

  return defineHandler(async event => {
    const result = await handler.handle(event.req, {
      prefix: '/api/application/v1',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
