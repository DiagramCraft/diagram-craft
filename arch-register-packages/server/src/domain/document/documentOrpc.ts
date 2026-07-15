import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import { documentContract } from '@arch-register/api-types/documentContract';
import { archiveDocumentTemplate, archiveDocumentType, createDocumentTemplate, createDocumentType, deleteDocumentTemplate, deleteDocumentType, getDocumentType, listDocumentTemplates, listDocumentTypes, updateDocumentTemplate, updateDocumentType } from './documentOperations';

type Context = { db: DatabaseAdapter; event: AuthenticatedEvent };
const router = implement(documentContract).$context<Context>().use(orpcErrorMiddleware);

export const documentORPCRouter = router.router({
  documentTypes: {
    list: router.documentTypes.list.handler(({ input, context }) => listDocumentTypes(context.db, input.params.workspace, input.query.include_archived, context.event)),
    get: router.documentTypes.get.handler(({ input, context }) => getDocumentType(context.db, input.params.workspace, input.params.id, context.event)),
    create: router.documentTypes.create.handler(({ input, context }) => createDocumentType(context.db, input.params.workspace, input.body, context.event)),
    update: router.documentTypes.update.handler(({ input, context }) => updateDocumentType(context.db, input.params.workspace, input.params.id, input.body, context.event)),
    archive: router.documentTypes.archive.handler(({ input, context }) => archiveDocumentType(context.db, input.params.workspace, input.params.id, input.body.archived, context.event)),
    remove: router.documentTypes.remove.handler(({ input, context }) => deleteDocumentType(context.db, input.params.workspace, input.params.id, context.event))
  },
  documentTemplates: {
    list: router.documentTemplates.list.handler(({ input, context }) => listDocumentTemplates(context.db, input.params.workspace, input.query.project_id, input.query.include_archived, context.event)),
    create: router.documentTemplates.create.handler(({ input, context }) => createDocumentTemplate(context.db, input.params.workspace, input.body, context.event)),
    update: router.documentTemplates.update.handler(({ input, context }) => updateDocumentTemplate(context.db, input.params.workspace, input.params.id, input.body, context.event)),
    archive: router.documentTemplates.archive.handler(({ input, context }) => archiveDocumentTemplate(context.db, input.params.workspace, input.params.id, input.body.archived, context.event)),
    remove: router.documentTemplates.remove.handler(({ input, context }) => deleteDocumentTemplate(context.db, input.params.workspace, input.params.id, context.event))
  }
});

export const documentOpenAPIHandler = new OpenAPIHandler(documentORPCRouter, { clientInterceptors: orpcErrorInterceptors });
export const createDocumentORPCHandler = (db: DatabaseAdapter) => defineHandler(async event => {
  const result = await documentOpenAPIHandler.handle(event.req, { prefix: '/api', context: { db, event: event as AuthenticatedEvent } });
  if (result.matched) return result.response;
});
