import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { governanceDocumentStatusConfigContract } from '@arch-register/api-types/governanceDocumentStatusConfigContract';
import type { GovernanceDocumentStatusConfig } from '@arch-register/api-types/governanceDocumentStatusConfigContract';
import { documentStatusApprovalConfigSchema } from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { DocumentField } from '@arch-register/api-types/documentContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { requireWorkspaceCapability } from '../auth/authorization';
import { DOCUMENT_STATUS_CASE_KIND } from '../document/documentWorkflowOperations';
import { encodeCaseSubkind } from './governanceCaseSubkind';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const configRouter = implement(governanceDocumentStatusConfigContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

const getDocumentType = async (db: DatabaseAdapter, workspace: string, id: string) => {
  const documentType = await db.document.getDocumentType(workspace, id);
  httpAssert.present(documentType, { status: 404, message: `Document type '${id}' not found` });
  return documentType;
};

const toApiConfig = (
  documentTypeId: string,
  row: Awaited<ReturnType<DatabaseAdapter['governanceCaseConfig']['getCaseConfig']>>
): GovernanceDocumentStatusConfig => {
  httpAssert.present(row, {
    status: 404,
    message: 'Document status workflow configuration not found'
  });
  const separator = `${documentTypeId}:`;
  httpAssert.true(row.case_subkind?.startsWith(separator) === true, {
    status: 400,
    message: 'Document status workflow configuration has an invalid subkind'
  });
  const fieldId = row.case_subkind!.slice(separator.length);
  return {
    document_type_id: documentTypeId,
    field_id: fieldId,
    case_subkind: row.case_subkind!,
    enabled: row.enabled,
    config: documentStatusApprovalConfigSchema.parse(row.config)
  };
};

const validateConfig = (
  fields: DocumentField[],
  fieldId: string,
  statuses: Record<
    string,
    import('@arch-register/api-types/governanceCaseConfigSchemas').DocumentStatusApproval
  >
) => {
  const field = fields.find(item => item.id === fieldId);
  httpAssert.present(field, { status: 404, message: `Document field '${fieldId}' not found` });
  httpAssert.true(field.type === 'enum', {
    status: 400,
    message: `Document field '${fieldId}' must be an enum field`
  });
  const values = new Set((field.enumOptions ?? []).map(option => option.value));
  for (const [status, approval] of Object.entries(statuses)) {
    httpAssert.true(values.has(status), {
      status: 400,
      message: `Status '${status}' is not defined on field '${fieldId}'`
    });
    if (!approval.required) continue;
    httpAssert.true((approval.requiredApprovals ?? 0) > 0, {
      status: 400,
      message: `Status '${status}' on field '${fieldId}' must require at least one approval`
    });
    if (approval.approverFieldId) {
      const source = fields.find(item => item.id === approval.approverFieldId);
      httpAssert.present(source, {
        status: 400,
        message: `Status '${status}' references unknown approver field '${approval.approverFieldId}'`
      });
      httpAssert.true(source.type === 'user_link' || source.type === 'team_link', {
        status: 400,
        message: `Approver field '${approval.approverFieldId}' must be a user or team field`
      });
    }
    httpAssert.true(
      Boolean(approval.approverFieldId) ||
        approval.fallbackUserIds.length > 0 ||
        approval.fallbackTeamIds.length > 0,
      {
        status: 400,
        message: `Status '${status}' on field '${fieldId}' needs an approver source or fallback`
      }
    );
  }
};

export const createGovernanceDocumentStatusConfigORPCRouter = () =>
  configRouter.router({
    governanceDocumentStatusConfig: {
      list: configRouter.governanceDocumentStatusConfig.list.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.settings');
        await getDocumentType(context.db, workspace, input.params.id);
        const prefix = `${input.params.id}:`;
        const rows = await context.db.governanceCaseConfig.listCaseConfigForKind(
          workspace,
          DOCUMENT_STATUS_CASE_KIND
        );
        return rows
          .filter(row => row.case_subkind?.startsWith(prefix) === true)
          .map(row => toApiConfig(input.params.id, row));
      }),
      update: configRouter.governanceDocumentStatusConfig.update.handler(
        async ({ input, context }) => {
          const { workspace, authCtx } = context;
          requireWorkspaceCapability(authCtx, 'ws.settings');
          const documentType = await getDocumentType(context.db, workspace, input.params.id);
          validateConfig(documentType.fields, input.params.fieldId, input.body.statuses);
          const config = documentStatusApprovalConfigSchema.parse({
            statuses: input.body.statuses
          });
          const row = await context.db.governanceCaseConfig.upsertCaseConfig({
            workspace,
            case_kind: DOCUMENT_STATUS_CASE_KIND,
            case_subkind: encodeCaseSubkind(input.params.id, input.params.fieldId),
            enabled: input.body.enabled,
            config,
            updated_at: new Date(),
            updated_by: context.event.context.user.id
          });
          return toApiConfig(input.params.id, row);
        }
      )
    }
  });

export const createGovernanceDocumentStatusConfigORPCHandler = (db: DatabaseAdapter) => {
  const handler = new OpenAPIHandler(createGovernanceDocumentStatusConfigORPCRouter(), {
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
