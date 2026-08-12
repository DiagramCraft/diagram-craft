import {
  listDocumentBacklinks,
  listDocuments,
  listRelatedContent
} from './markdownListingOperations';
import { projectRouter } from './projectRouter';

export const projectDocumentDiscoveryHandlers = {
  listRelatedContent: projectRouter.projects.listRelatedContent.handler(
    async ({ input, context }) =>
      listRelatedContent(context.db, input.params.workspace, input.params.entityId, context.event)
  ),
  listDocumentBacklinks: projectRouter.projects.listDocumentBacklinks.handler(
    async ({ input, context }) =>
      listDocumentBacklinks(context.db, input.params.workspace, input.params.nodeId, context.event)
  ),
  listDocuments: projectRouter.projects.listDocuments.handler(async ({ input, context }) =>
    listDocuments(
      context.db,
      input.params.workspace,
      {
        q: input.query.q,
        scope: input.query.scope,
        projectId: input.query.project_id,
        entityId: input.query.entity_id,
        documentTypeId: input.query.document_type_id,
        conditions: input.query.conditions,
        sort: input.query.sort,
        sortDir: input.query.sort_dir,
        limit: input.query.limit
      },
      context.event
    )
  )
};
