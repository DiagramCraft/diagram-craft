import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { governanceWorkflowConfigContract } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceWorkflowConfigRow } from '@arch-register/api-types/governanceWorkflowConfigContract';
import { governanceWorkflowConfigSchema } from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import { defaultWorkflowConfigForCaseKind, type GovernanceRegistry } from './governanceRegistry';
import { CASE_KIND_DESCRIPTIONS, CASE_KIND_LABELS } from './governanceCaseKindLabels';
import {
  parseGovernanceWorkflowConfig,
  validateDocumentStatusWorkflowConfig
} from './governanceWorkflowConfig';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const workflowConfigRouter = implement(governanceWorkflowConfigContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

const toCaseKind = (caseKind: string, config: ReturnType<GovernanceRegistry['get']>) => ({
  case_kind: caseKind,
  label: CASE_KIND_LABELS[caseKind] ?? caseKind,
  description: CASE_KIND_DESCRIPTIONS[caseKind] ?? '',
  supportsSubkind: config?.workflowConfig?.supportsSubkind ?? false,
  supportsWorkspaceScope: config?.workflowConfig?.supportsWorkspaceScope ?? true,
  supportsApprovals: config?.workflowConfig?.supportsApprovals ?? false,
  supportsReminders: config?.workflowConfig?.supportsReminders ?? false,
  supportsEscalation: config?.workflowConfig?.supportsEscalation ?? false,
  defaultConfig: config
    ? defaultWorkflowConfigForCaseKind(config)
    : governanceWorkflowConfigSchema.parse({ extensions: {} })
});

const toApiRow = async (
  db: DatabaseAdapter,
  workspace: string,
  row: Awaited<ReturnType<DatabaseAdapter['governanceCaseConfig']['listCaseConfig']>>[number],
  registry: GovernanceRegistry
): Promise<GovernanceWorkflowConfigRow> => {
  const kindConfig = registry.get(row.case_kind);
  const config = parseGovernanceWorkflowConfig(row.config, row.enabled);
  const subkindLabel = kindConfig?.workflowConfig?.labelSubkind
    ? await kindConfig.workflowConfig.labelSubkind(db, workspace, row.case_subkind)
    : row.case_subkind;
  return {
    id: row.id,
    case_kind: row.case_kind,
    case_kind_label: CASE_KIND_LABELS[row.case_kind] ?? row.case_kind,
    case_kind_description: CASE_KIND_DESCRIPTIONS[row.case_kind] ?? '',
    case_subkind: row.case_subkind,
    case_subkind_label: subkindLabel,
    enabled: row.enabled,
    config,
    updated_at: row.updated_at.toISOString(),
    updated_by: row.updated_by
  };
};

export const createGovernanceWorkflowConfigORPCRouter = (registry: GovernanceRegistry) =>
  workflowConfigRouter.router({
    governanceWorkflowConfig: {
      list: workflowConfigRouter.governanceWorkflowConfig.list.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.settings');
        const rows = await context.db.governanceCaseConfig.listCaseConfig(workspace);
        return {
          case_kinds: [...registry.entries()].map(([caseKind, config]) =>
            toCaseKind(caseKind, config)
          ),
          configs: await Promise.all(
            rows.map(row => toApiRow(context.db, workspace, row, registry))
          )
        };
      }),
      upsert: workflowConfigRouter.governanceWorkflowConfig.upsert.handler(
        async ({ input, context }) => {
          const { workspace, authCtx } = context;
          requireWorkspaceCapability(authCtx, 'ws.settings');
          const kindConfig = registry.get(input.body.case_kind);
          httpAssert.present(kindConfig, {
            status: 404,
            message: `Unknown governance case kind '${input.body.case_kind}'`
          });
          httpAssert.true(
            input.body.case_subkind != null
              ? kindConfig.workflowConfig?.supportsSubkind === true
              : kindConfig.workflowConfig?.supportsWorkspaceScope !== false,
            {
              status: 400,
              message: `Case kind '${input.body.case_kind}' does not support subkind-scoped configuration`
            }
          );
          if (input.body.case_subkind != null && kindConfig.workflowConfig?.validateSubkind) {
            const error = await kindConfig.workflowConfig.validateSubkind(
              context.db,
              workspace,
              input.body.case_subkind
            );
            httpAssert.true(error == null, {
              status: 400,
              message: error ?? 'Invalid case subkind'
            });
          }
          const config = governanceWorkflowConfigSchema.parse(input.body.config);
          httpAssert.true(
            kindConfig.workflowConfig?.supportsApprovals !== false || config.approvals == null,
            { status: 400, message: 'This workflow does not support approval configuration' }
          );
          httpAssert.true(
            kindConfig.workflowConfig?.supportsReminders !== false || config.reminders == null,
            { status: 400, message: 'This workflow does not support reminder configuration' }
          );
          httpAssert.true(
            kindConfig.workflowConfig?.supportsEscalation !== false || config.escalation == null,
            { status: 400, message: 'This workflow does not support escalation configuration' }
          );
          if (kindConfig.workflowConfig?.validateConfig)
            kindConfig.workflowConfig.validateConfig(config);
          if (input.body.case_kind === 'document.status')
            validateDocumentStatusWorkflowConfig(config);
          httpAssert.true(
            (config.escalation?.fallbackUserIds.length ?? 0) +
              (config.escalation?.fallbackTeamIds.length ?? 0) <=
              1,
            {
              status: 400,
              message: 'Escalation configuration supports at most one fallback target'
            }
          );
          const row = await context.db.governanceCaseConfig.upsertCaseConfig({
            workspace,
            case_kind: input.body.case_kind,
            case_subkind: input.body.case_subkind,
            enabled: input.body.enabled ?? true,
            config,
            updated_at: new Date(),
            updated_by: context.event.context.user.id
          });
          return toApiRow(context.db, workspace, row, registry);
        }
      ),
      reset: workflowConfigRouter.governanceWorkflowConfig.reset.handler(
        async ({ input, context }) => {
          const { workspace, authCtx } = context;
          requireWorkspaceCapability(authCtx, 'ws.settings');
          const kindConfig = registry.get(input.body.case_kind);
          httpAssert.present(kindConfig, {
            status: 404,
            message: `Unknown governance case kind '${input.body.case_kind}'`
          });
          httpAssert.true(
            input.body.case_subkind != null
              ? kindConfig.workflowConfig?.supportsSubkind === true
              : kindConfig.workflowConfig?.supportsWorkspaceScope !== false,
            {
              status: 400,
              message: `Case kind '${input.body.case_kind}' does not support subkind-scoped configuration`
            }
          );
          const deleted = await context.db.governanceCaseConfig.deleteCaseConfig(
            workspace,
            input.body.case_kind,
            input.body.case_subkind
          );
          return { reset: deleted };
        }
      )
    }
  });

export const createGovernanceWorkflowConfigORPCHandler = (
  db: DatabaseAdapter,
  registry: GovernanceRegistry
) => {
  const handler = new OpenAPIHandler(createGovernanceWorkflowConfigORPCRouter(registry), {
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
