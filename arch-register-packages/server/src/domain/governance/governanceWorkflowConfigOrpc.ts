import { randomUUID } from 'node:crypto';
import { implement } from '@orpc/server';
import { governanceWorkflowConfigContract } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceWorkflowConfigRow } from '@arch-register/api-types/governanceWorkflowConfigContract';
import { governanceWorkflowConfigSchema } from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import {
  defaultWorkflowConfigForCaseKind,
  type GovernanceRegistry,
  type GovernanceWorkflowStrategy
} from './governanceRegistry';
import { CASE_KIND_DESCRIPTIONS, CASE_KIND_LABELS } from './governanceCaseKindLabels';
import {
  parseGovernanceWorkflowConfig,
  validateDocumentStatusWorkflowConfig
} from './governanceWorkflowConfig';
import { validateGovernanceInitiationFieldDefinitions } from './governanceInitiationFields';

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
  supportsMultiScope: config?.workflowConfig?.supportsMultiScope ?? false,
  supportsWorkspaceScope: config?.workflowConfig?.supportsWorkspaceScope ?? true,
  supportsApprovals: config?.workflowConfig?.supportsApprovals ?? false,
  supportsReminders: config?.workflowConfig?.supportsReminders ?? false,
  supportsEscalation: config?.workflowConfig?.supportsEscalation ?? false,
  supportsInitiationFields: config?.workflowConfig?.supportsInitiationFields ?? true,
  approvalStrategies: [...(config?.workflowConfig?.approvalStrategies ?? [])],
  escalationStrategies: [...(config?.workflowConfig?.escalationStrategies ?? [])],
  defaultConfig: config
    ? defaultWorkflowConfigForCaseKind(config)
    : governanceWorkflowConfigSchema.parse({ extensions: {} })
});

const normalizeStrategy = <
  T extends { strategy?: string; strategyConfig: Record<string, unknown> }
>(
  section: T | undefined,
  strategies: readonly GovernanceWorkflowStrategy[] | undefined
): T | undefined => {
  if (!section) return section;
  const strategy = section.strategy ?? strategies?.[0]?.id;
  return strategy ? { ...section, strategy } : section;
};

const validateFallbackTargets = async (
  db: DatabaseAdapter,
  workspace: string,
  section: { fallbackUserIds: string[]; fallbackTeamIds: string[] } | undefined
) => {
  if (!section) return;
  const [users, teams] = await Promise.all([
    db.auth.listUsers(),
    db.workspace.listTeams(workspace)
  ]);
  const activeUserIds = new Set(users.filter(user => user.is_active).map(user => user.id));
  const teamIds = new Set(teams.map(team => team.id));
  httpAssert.true(
    section.fallbackUserIds.every(userId => activeUserIds.has(userId)),
    {
      status: 400,
      message: 'Fallback users must be active workspace users'
    }
  );
  httpAssert.true(
    section.fallbackTeamIds.every(teamId => teamIds.has(teamId)),
    {
      status: 400,
      message: 'Fallback teams must belong to the workspace'
    }
  );
};

const toApiRow = async (
  db: DatabaseAdapter,
  workspace: string,
  row: Awaited<ReturnType<DatabaseAdapter['governanceCaseConfig']['listCaseConfig']>>[number],
  registry: GovernanceRegistry
): Promise<GovernanceWorkflowConfigRow> => {
  const kindConfig = registry.get(row.case_kind);
  const parsedConfig = parseGovernanceWorkflowConfig(row.config, row.enabled);
  const config = {
    ...parsedConfig,
    external: parsedConfig.external ?? false,
    approvals: normalizeStrategy(
      parsedConfig.approvals,
      kindConfig?.workflowConfig?.approvalStrategies
    ),
    escalation: normalizeStrategy(
      parsedConfig.escalation,
      kindConfig?.workflowConfig?.escalationStrategies
    )
  };
  const labelSubkind = kindConfig?.workflowConfig?.labelSubkind;
  const subkindLabels = await Promise.all(
    row.case_subkinds.map(async subkind =>
      labelSubkind ? ((await labelSubkind(db, workspace, subkind)) ?? subkind) : subkind
    )
  );
  return {
    id: row.id,
    case_kind: row.case_kind,
    case_kind_label: CASE_KIND_LABELS[row.case_kind] ?? row.case_kind,
    case_kind_description: CASE_KIND_DESCRIPTIONS[row.case_kind] ?? '',
    case_subkinds: row.case_subkinds,
    case_subkind_labels: subkindLabels,
    name: row.name,
    description: row.description,
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
          const subkinds = [...new Set(input.body.case_subkinds)];
          httpAssert.true(
            subkinds.length > 0
              ? kindConfig.workflowConfig?.supportsSubkind === true
              : kindConfig.workflowConfig?.supportsWorkspaceScope !== false,
            {
              status: 400,
              message: `Case kind '${input.body.case_kind}' does not support subkind-scoped configuration`
            }
          );
          httpAssert.true(
            subkinds.length <= 1 || kindConfig.workflowConfig?.supportsMultiScope === true,
            {
              status: 400,
              message: `Case kind '${input.body.case_kind}' does not support attaching a workflow to several scopes`
            }
          );
          if (input.body.id != null) {
            const existing = await context.db.governanceCaseConfig.getCaseConfigById(
              workspace,
              input.body.id
            );
            httpAssert.present(existing, {
              status: 404,
              message: 'Workflow configuration not found'
            });
            httpAssert.true(existing.case_kind === input.body.case_kind, {
              status: 400,
              message: 'The case kind of an existing workflow configuration cannot be changed'
            });
          }
          if (kindConfig.workflowConfig?.validateSubkind) {
            for (const subkind of subkinds) {
              const error = await kindConfig.workflowConfig.validateSubkind(
                context.db,
                workspace,
                subkind
              );
              httpAssert.true(error == null, {
                status: 400,
                message: error ?? 'Invalid case subkind'
              });
            }
          }
          // Reject overlap up front (also enforced by the database) so the error names the schemas
          const sameKind = await context.db.governanceCaseConfig.listCaseConfigForKind(
            workspace,
            input.body.case_kind
          );
          const overlapping = sameKind.filter(
            other =>
              other.id !== input.body.id &&
              (subkinds.length === 0
                ? other.case_subkinds.length === 0
                : other.case_subkinds.some(subkind => subkinds.includes(subkind)))
          );
          if (overlapping.length > 0) {
            const labels = await Promise.all(
              subkinds
                .filter(subkind => overlapping.some(other => other.case_subkinds.includes(subkind)))
                .map(async subkind =>
                  kindConfig.workflowConfig?.labelSubkind
                    ? ((await kindConfig.workflowConfig.labelSubkind(
                        context.db,
                        workspace,
                        subkind
                      )) ?? subkind)
                    : subkind
                )
            );
            httpAssert.true(false, {
              status: 409,
              message:
                subkinds.length === 0
                  ? 'A workspace-wide workflow configuration already exists for this workflow'
                  : `Another workflow configuration already covers: ${labels.join(', ')}`
            });
          }
          const parsedConfig = governanceWorkflowConfigSchema.parse(input.body.config);
          const config = {
            ...parsedConfig,
            approvals: normalizeStrategy(
              parsedConfig.approvals,
              kindConfig.workflowConfig?.approvalStrategies
            ),
            escalation: normalizeStrategy(
              parsedConfig.escalation,
              kindConfig.workflowConfig?.escalationStrategies
            )
          };
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
          httpAssert.true(
            kindConfig.workflowConfig?.supportsInitiationFields !== false ||
              config.initiationFields == null ||
              config.initiationFields.length === 0,
            { status: 400, message: 'This workflow does not support initiation fields' }
          );
          await validateGovernanceInitiationFieldDefinitions(
            context.db,
            workspace,
            config.initiationFields ?? []
          );
          const approvalStrategy = config.approvals?.strategy;
          if (approvalStrategy) {
            const descriptor = kindConfig.workflowConfig?.approvalStrategies?.find(
              strategy => strategy.id === approvalStrategy
            );
            httpAssert.present(descriptor, {
              status: 400,
              message: `Unsupported approval strategy '${approvalStrategy}'`
            });
            const error = kindConfig.workflowConfig?.validateApprovalStrategy
              ? await kindConfig.workflowConfig.validateApprovalStrategy(
                  context.db,
                  workspace,
                  subkinds[0] ?? null,
                  approvalStrategy,
                  config.approvals?.strategyConfig ?? {}
                )
              : null;
            httpAssert.true(error == null, {
              status: 400,
              message: error ?? 'Invalid approval strategy'
            });
          }
          const escalationStrategy = config.escalation?.strategy;
          if (escalationStrategy) {
            const descriptor = kindConfig.workflowConfig?.escalationStrategies?.find(
              strategy => strategy.id === escalationStrategy
            );
            httpAssert.present(descriptor, {
              status: 400,
              message: `Unsupported escalation strategy '${escalationStrategy}'`
            });
            const error = kindConfig.workflowConfig?.validateEscalationStrategy
              ? await kindConfig.workflowConfig.validateEscalationStrategy(
                  context.db,
                  workspace,
                  subkinds[0] ?? null,
                  escalationStrategy,
                  config.escalation?.strategyConfig ?? {}
                )
              : null;
            httpAssert.true(error == null, {
              status: 400,
              message: error ?? 'Invalid escalation strategy'
            });
          }
          if (kindConfig.workflowConfig?.validateConfig)
            kindConfig.workflowConfig.validateConfig(config);
          if (input.body.case_kind === 'document.status')
            validateDocumentStatusWorkflowConfig(config);
          await validateFallbackTargets(context.db, workspace, config.approvals);
          await validateFallbackTargets(context.db, workspace, config.escalation);
          const row = await context.db.governanceCaseConfig.upsertCaseConfig({
            id: input.body.id ?? randomUUID(),
            workspace,
            case_kind: input.body.case_kind,
            case_subkinds: subkinds,
            name: input.body.name,
            description: input.body.description,
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
          const deleted = await context.db.governanceCaseConfig.deleteCaseConfig(
            workspace,
            input.body.id
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
  return createOrpcHandler(createGovernanceWorkflowConfigORPCRouter(registry), {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
};
