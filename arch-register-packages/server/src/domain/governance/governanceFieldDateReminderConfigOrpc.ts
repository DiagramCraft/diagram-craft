import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { governanceFieldDateReminderConfigContract } from '@arch-register/api-types/governanceFieldDateReminderConfigContract';
import type { GovernanceFieldDateReminderConfig } from '@arch-register/api-types/governanceFieldDateReminderConfigContract';
import { fieldDateReminderCaseConfigSchema } from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { FIELD_DATE_REMINDER_CASE_KIND } from '../catalog/fieldDateReminderJob';
import { encodeCaseSubkind } from './governanceCaseSubkind';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const configRouter = implement(governanceFieldDateReminderConfigContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

const getSchema = async (db: DatabaseAdapter, workspace: string, schemaId: string) => {
  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 404, message: `Schema '${schemaId}' not found` });
  return schema;
};

const getDateField = (schema: Awaited<ReturnType<typeof getSchema>>, fieldId: string) => {
  const field = schema.fields.find(candidate => candidate.id === fieldId);
  httpAssert.present(field, { status: 404, message: `Schema field '${fieldId}' not found` });
  httpAssert.true(field.type === 'date', {
    status: 400,
    message: `Schema field '${fieldId}' must be a date field`
  });
  return field;
};

const toApiConfig = (
  schemaId: string,
  row: Awaited<ReturnType<DatabaseAdapter['governanceCaseConfig']['getCaseConfig']>>
): GovernanceFieldDateReminderConfig => {
  httpAssert.present(row, { status: 404, message: 'Field-date reminder configuration not found' });
  const prefix = `${schemaId}:`;
  httpAssert.true(row.case_subkind?.startsWith(prefix) === true, {
    status: 400,
    message: 'Field-date reminder configuration has an invalid subkind'
  });
  return {
    schema_id: schemaId,
    field_id: row.case_subkind!.slice(prefix.length),
    case_subkind: row.case_subkind!,
    enabled: row.enabled,
    config: fieldDateReminderCaseConfigSchema.parse(row.config)
  };
};

export const createGovernanceFieldDateReminderConfigORPCRouter = () =>
  configRouter.router({
    governanceFieldDateReminderConfig: {
      list: configRouter.governanceFieldDateReminderConfig.list.handler(
        async ({ input, context }) => {
          const { workspace, authCtx } = context;
          requireSchemaRead(authCtx);
          const schema = await getSchema(context.db, workspace, input.params.id);
          const prefix = `${schema.id}:`;
          const rows = await context.db.governanceCaseConfig.listCaseConfigForKind(
            workspace,
            FIELD_DATE_REMINDER_CASE_KIND
          );
          return rows
            .filter(row => row.case_subkind?.startsWith(prefix) === true)
            .filter(row =>
              schema.fields.some(field => field.id === row.case_subkind!.slice(prefix.length))
            )
            .map(row => toApiConfig(schema.id, row));
        }
      ),
      update: configRouter.governanceFieldDateReminderConfig.update.handler(
        async ({ input, context }) => {
          const { workspace, authCtx } = context;
          requireWorkspaceCapability(authCtx, 'schema.edit');
          const schema = await getSchema(context.db, workspace, input.params.id);
          getDateField(schema, input.params.fieldId);
          const config = fieldDateReminderCaseConfigSchema.parse({
            approaching_days: input.body.approaching_days,
            overdue_days: input.body.overdue_days
          });
          const row = await context.db.governanceCaseConfig.upsertCaseConfig({
            workspace,
            case_kind: FIELD_DATE_REMINDER_CASE_KIND,
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

export const createGovernanceFieldDateReminderConfigORPCHandler = (db: DatabaseAdapter) => {
  const handler = new OpenAPIHandler(createGovernanceFieldDateReminderConfigORPCRouter(), {
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
