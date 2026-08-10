import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listWorkspaceRelations,
  queryWorkspaceRelations,
  getWorkspaceRelation,
  createWorkspaceRelation,
  updateWorkspaceRelation,
  deleteWorkspaceRelation,
  listTypedRelationsForEntity
} from './relationOperations';
import {
  listWorkspaceRelationSchemas,
  getWorkspaceRelationSchema
} from './relationSchemaOperations';
import {
  commitRelationsImportOperation,
  downloadRelationImportTemplateOperation,
  exportRelationsCsvOperation,
  parseRelationsImportOperation
} from './relationCsvOperations';
import { workspaceRelationContract } from '@arch-register/api-types/relationContract';
import { integrationRelationContract } from '@arch-register/api-types/integrationRelationContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const relationRouter = implement(workspaceRelationContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceRelationORPCRouter = relationRouter.router({
  relations: {
    list: relationRouter.relations.list.handler(async ({ input, context }) => {
      const { schemaId, inEntityId, outEntityId, limit, offset } = input.query;
      return await listWorkspaceRelations(
        context.db,
        input.params.workspace,
        { schemaId, inEntityId, outEntityId },
        { limit, offset },
        context.event
      );
    }),
    query: relationRouter.relations.query.handler(async ({ input, context }) => {
      const { relationQuery, view, limit, offset } = input.query;
      return await queryWorkspaceRelations(
        context.db,
        input.params.workspace,
        relationQuery,
        { view, limit, offset },
        context.event
      );
    }),
    exportCsv: relationRouter.relations.exportCsv.handler(async ({ input, context }) =>
      exportRelationsCsvOperation(
        context.db,
        input.params.workspace,
        context.event,
        input.query.relationQuery
      )
    ),
    importParse: relationRouter.relations.importParse.handler(async ({ input, context }) =>
      parseRelationsImportOperation(
        context.db,
        input.params.workspace,
        context.event,
        input.body.csvContent
      )
    ),
    importCommit: relationRouter.relations.importCommit.handler(async ({ input, context }) =>
      commitRelationsImportOperation(
        context.db,
        input.params.workspace,
        context.event,
        input.body.relations
      )
    ),
    downloadTemplate: relationRouter.relations.downloadTemplate.handler(
      async ({ input, context }) =>
        downloadRelationImportTemplateOperation(
          context.db,
          input.params.workspace,
          context.event,
          input.params.id
        )
    ),
    get: relationRouter.relations.get.handler(async ({ input, context }) => {
      return await getWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    create: relationRouter.relations.create.handler(async ({ input, context }) => {
      return await createWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.body,
        context.event
      );
    }),
    update: relationRouter.relations.update.handler(async ({ input, context }) => {
      return await updateWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      );
    }),
    remove: relationRouter.relations.remove.handler(async ({ input, context }) => {
      return await deleteWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    listForEntity: relationRouter.relations.listForEntity.handler(async ({ input, context }) => {
      return await listTypedRelationsForEntity(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    })
  }
});

const integrationRelationRouter = implement(integrationRelationContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const integrationRelationORPCRouter = integrationRelationRouter.router({
  integrationRelationSchemas: {
    list: integrationRelationRouter.integrationRelationSchemas.list.handler(
      async ({ input, context }) =>
        await listWorkspaceRelationSchemas(context.db, input.params.workspace, context.event)
    ),
    get: integrationRelationRouter.integrationRelationSchemas.get.handler(
      async ({ input, context }) =>
        await getWorkspaceRelationSchema(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    )
  },
  integrationRelations: {
    list: integrationRelationRouter.integrationRelations.list.handler(
      async ({ input, context }) => {
        const { schemaId, inEntityId, outEntityId, limit, offset } = input.query;
        return await listWorkspaceRelations(
          context.db,
          input.params.workspace,
          { schemaId, inEntityId, outEntityId },
          { limit, offset },
          context.event
        );
      }
    ),
    get: integrationRelationRouter.integrationRelations.get.handler(
      async ({ input, context }) =>
        await getWorkspaceRelation(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    ),
    create: integrationRelationRouter.integrationRelations.create.handler(
      async ({ input, context }) =>
        await createWorkspaceRelation(context.db, input.params.workspace, input.body, context.event)
    ),
    update: integrationRelationRouter.integrationRelations.update.handler(
      async ({ input, context }) =>
        await updateWorkspaceRelation(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body,
          context.event
        )
    ),
    remove: integrationRelationRouter.integrationRelations.remove.handler(
      async ({ input, context }) =>
        await deleteWorkspaceRelation(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    ),
    listForEntity: integrationRelationRouter.integrationRelations.listForEntity.handler(
      async ({ input, context }) =>
        await listTypedRelationsForEntity(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    )
  }
});

export const createWorkspaceRelationORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceRelationORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });

export const createIntegrationRelationORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(integrationRelationORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
