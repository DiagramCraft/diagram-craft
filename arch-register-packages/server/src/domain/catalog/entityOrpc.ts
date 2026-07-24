import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import { requireEntityAction, requireProjectAccess } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  entityScoped,
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { buildEntityGrantInputs } from './dataHelpers';
import { logAudit } from '../audit/db/auditLogging';
import { importParse, importCommit } from './importOperations';
import {
  listEntitiesWithCount,
  countEntities,
  getEntityFacets,
  getTimelineMarkers,
  getEntityTree,
  getEntity
} from './entityQueryOperations';
import {
  getEntityRelations,
  getBatchEntityRelations,
  getEntityDependents
} from './entityRelationshipOperations';
import {
  createEntity,
  bulkCreateEntities,
  updateEntity,
  cloneEntity,
  deleteEntity
} from './entityMutationOperations';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';
import {
  buildEntityQueryForExecution,
  findEntityQueryRequestConflicts,
  parseEntityQuery
} from './entityQuery';
import { downloadEntityImportTemplate, exportEntitiesCsv } from './entityCsvOperations';
import {
  parseEntityQueryText,
  printEntityQueryText,
  type EnumCatalog
} from './entityQueryTextCompiler';
import { validateEntityQueryIR, type SchemaCatalog } from './entityQueryIRValidator';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const entityRouter = implement(workspaceEntityContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

const assertCompatibleEntityQueryRequest = (query: Parameters<typeof parseEntityQuery>[0]) => {
  const conflicts = findEntityQueryRequestConflicts(query);
  httpAssert.true(conflicts.length === 0, {
    status: 400,
    message: `EntityQuery conflicts with request field(s): ${conflicts.join(', ')}`
  });
};

const entityHandlers = {
  list: entityRouter.entities.list.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const query = parseEntityQuery(input.query);
    assertCompatibleEntityQueryRequest(input.query);
    query.entityQuery = buildEntityQueryForExecution(input.query, query);
    if (query.collectionId) {
      const collection = await context.db.view.getCollection(
        authCtx.userId,
        workspace,
        query.collectionId
      );
      httpAssert.present(collection, { status: 404, message: 'Collection not found' });
    }
    const projectId = input.query.entityQuery?.projectId ?? input.query.projectId;
    if (projectId) {
      const project = await context.db.project.getProject(workspace, projectId);
      httpAssert.present(project, {
        status: 404,
        message: `Project '${projectId}' not found`
      });
      requireProjectAccess(authCtx, project.owner);
    }
    return await listEntitiesWithCount(context.db, workspace, authCtx, query);
  }),

  count: entityRouter.entities.count.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const query = parseEntityQuery(input.query);
    assertCompatibleEntityQueryRequest(input.query);
    query.entityQuery = buildEntityQueryForExecution(input.query, query);
    if (query.collectionId) {
      const collection = await context.db.view.getCollection(
        authCtx.userId,
        workspace,
        query.collectionId
      );
      httpAssert.present(collection, { status: 404, message: 'Collection not found' });
    }
    const projectId = input.query.entityQuery?.projectId ?? input.query.projectId;
    if (projectId) {
      const project = await context.db.project.getProject(workspace, projectId);
      httpAssert.present(project, {
        status: 404,
        message: `Project '${projectId}' not found`
      });
      requireProjectAccess(authCtx, project.owner);
    }
    const total = await countEntities(context.db, workspace, authCtx, query);
    return { total };
  }),

  facets: entityRouter.entities.facets.handler(async ({ context }) => {
    const { workspace, authCtx } = context;
    return await getEntityFacets(context.db, workspace, authCtx);
  }),

  timelineMarkers: entityRouter.entities.timelineMarkers.handler(async ({ context }) => {
    const { workspace } = context;
    return await getTimelineMarkers(context.db, workspace);
  }),

  tree: entityRouter.entities.tree.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const projectId = input.query.entityQuery?.projectId ?? input.query.projectId;
    if (projectId) {
      const project = await context.db.project.getProject(workspace, projectId);
      httpAssert.present(project, {
        status: 404,
        message: `Project '${projectId}' not found`
      });
      requireProjectAccess(authCtx, project.owner);
    }
    const query = parseEntityQuery(input.query);
    assertCompatibleEntityQueryRequest(input.query);
    query.entityQuery = buildEntityQueryForExecution(input.query, query);
    httpAssert.true(!query.collectionId, {
      status: 400,
      message: 'Collections support table and cards views only'
    });
    return await getEntityTree(context.db, workspace, authCtx, {
      entityQuery: query.entityQuery,
      schemaId: query.schemaId,
      owner: query.owner,
      lifecycle: query.lifecycle,
      q: query.q,
      projectId: query.projectId,
      projectScope: query.projectScope,
      conditions: query.conditions,
      assessmentId: query.assessmentId
    });
  }),

  get: entityRouter.entities.get.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    return await getEntity(context.db, workspace, input.params.id, authCtx);
  }),

  relations: entityRouter.entities.relations.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    return await getEntityRelations(context.db, workspace, input.params.id, authCtx);
  }),

  batchRelations: entityRouter.entities.batchRelations.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    return await getBatchEntityRelations(context.db, workspace, input.body.ids, authCtx);
  }),

  dependents: entityRouter.entities.dependents.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const transitive = input.query?.transitive === 'true';
    const maxDepth = input.query?.maxDepth ? parseInt(input.query.maxDepth, 10) : undefined;
    return await getEntityDependents(
      context.db,
      workspace,
      input.params.id,
      { transitive, maxDepth },
      authCtx
    );
  }),

  create: entityRouter.entities.create.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const auditUser = context.event.context.user;
    return await createEntity(
      context.db,
      workspace,
      input.body as Record<string, unknown>,
      authCtx,
      { id: auditUser.id, displayName: auditUser.display_name }
    );
  }),

  bulkCreate: entityRouter.entities.bulkCreate.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const auditUser = context.event.context.user;
    return await bulkCreateEntities(
      context.db,
      workspace,
      input.body.entities as Record<string, unknown>[],
      authCtx,
      { id: auditUser.id, displayName: auditUser.display_name }
    );
  }),

  update: entityRouter.entities.update.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const auditUser = context.event.context.user;
    return await updateEntity(
      context.db,
      workspace,
      input.params.id,
      input.body as Record<string, unknown>,
      authCtx,
      { id: auditUser.id, displayName: auditUser.display_name }
    );
  }),

  clone: entityRouter.entities.clone.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const auditUser = context.event.context.user;
    return await cloneEntity(context.db, workspace, input.params.id, authCtx, {
      id: auditUser.id,
      displayName: auditUser.display_name
    });
  }),

  remove: entityRouter.entities.remove.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const auditUser = context.event.context.user;
    return await deleteEntity(context.db, workspace, input.params.id, authCtx, {
      id: auditUser.id,
      displayName: auditUser.display_name
    });
  }),

  getAccess: entityRouter.entities.getAccess.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const entity = await context.db.catalog.getEntity(workspace, input.params.id);
    httpAssert.present(entity, {
      status: 404,
      message: `Data record '${input.params.id}' not found`
    });
    requireEntityAction(
      authCtx,
      entity,
      'view_entity',
      'You do not have access to view this entity'
    );
    const grants = await context.db.catalog.getEntityGrants(workspace, entity.id);
    return {
      owner: entity.owner,
      project_id: entity.project_id,
      approval_policy_override: entity.approval_policy_override ?? null,
      grants: grants.map(g => ({ ...g, created_at: g.created_at.toISOString() }))
    };
  }),

  updateAccess: entityRouter.entities.updateAccess.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const entity = await context.db.catalog.getEntity(workspace, input.params.id);
    httpAssert.present(entity, {
      status: 404,
      message: `Data record '${input.params.id}' not found`
    });
    requireEntityAction(
      authCtx,
      entity,
      'admin_entity',
      'You do not have permission to manage entity access'
    );
    const rows = buildEntityGrantInputs(workspace, entity.id, input.body.grants, new Date());
    const grants = await context.db.catalog.replaceEntityGrants(workspace, entity.id, rows);
    let current = entity;
    if (input.body.approval_policy_override !== undefined) {
      const updated = await context.db.catalog.setEntityApprovalPolicyOverride(
        workspace,
        entity.id,
        input.body.approval_policy_override
      );
      httpAssert.present(updated, {
        status: 409,
        message: 'Entity changed while access was updated'
      });
      await logAudit(context.db, {
        workspace,
        userId: context.event.context.user.id,
        userDisplayName: context.event.context.user.display_name,
        operation: 'update',
        entityType: 'entity',
        entityId: entity.id,
        entityName: entity.name,
        entitySlug: entity.slug,
        schemaId: entity.schema_id,
        changes: {
          old: { approval_policy_override: entity.approval_policy_override ?? null },
          new: { approval_policy_override: updated.approval_policy_override ?? null }
        },
        metadata: { approvalPolicyOverrideChanged: true }
      });
      current = updated;
    }
    return {
      owner: current.owner,
      project_id: current.project_id,
      approval_policy_override: current.approval_policy_override ?? null,
      grants: grants.map(g => ({ ...g, created_at: g.created_at.toISOString() }))
    };
  })
};

const buildQueryCatalogs = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<{ schemas: SchemaCatalog; enums: EnumCatalog }> => {
  const [schemas, enums] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.catalog.listEnums(workspace)
  ]);
  return {
    schemas: new Map(schemas.map(schema => [schema.id, schema])),
    enums: new Map(enums.map(en => [en.id, en]))
  };
};

const entityQueryTextHandlers = {
  parseText: entityRouter.entityQueryText.parseText.handler(async ({ input, context }) => {
    const { workspace } = context;
    const { schemas, enums } = await buildQueryCatalogs(context.db, workspace);
    const result = parseEntityQueryText(input.query.text, schemas, enums);
    if (!result.ok) return result;
    const validation = validateEntityQueryIR(result.query, schemas);
    if (!validation.ok) {
      return {
        ok: false,
        errors: validation.errors.map(error => ({
          offset: 0,
          message: `${error.path.join('.')}: ${error.message}`
        }))
      };
    }
    return result;
  }),

  printText: entityRouter.entityQueryText.printText.handler(async ({ input, context }) => {
    const { workspace } = context;
    const { schemas } = await buildQueryCatalogs(context.db, workspace);
    return { text: printEntityQueryText(input.body.query, schemas) };
  })
};

const entityTransferHandlers = {
  importParse: entityRouter.entities.importParse.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    return await importParse(context.db, authCtx, {
      workspace,
      schemaId: input.body.schemaId,
      csvContent: input.body.csvContent
    });
  }),

  importCommit: entityRouter.entities.importCommit.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const auditUser = context.event.context.user;
    return await importCommit(context.db, authCtx, {
      workspace,
      schemaId: input.body.schemaId,
      entities: input.body.entities as Array<Record<string, unknown> & { _existingId?: string }>,
      auditUser: { id: auditUser.id, display_name: auditUser.display_name }
    });
  }),

  exportCsv: entityRouter.entities.exportCsv.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const query = parseEntityQuery(input.query);
    assertCompatibleEntityQueryRequest(input.query);
    query.entityQuery = buildEntityQueryForExecution(input.query, query);
    if (query.collectionId) {
      const collection = await context.db.view.getCollection(
        authCtx.userId,
        workspace,
        query.collectionId
      );
      httpAssert.present(collection, { status: 404, message: 'Collection not found' });
    }
    const projectId = input.query.entityQuery?.projectId ?? input.query.projectId;
    if (projectId) {
      const project = await context.db.project.getProject(workspace, projectId);
      httpAssert.present(project, {
        status: 404,
        message: `Project '${projectId}' not found`
      });
      requireProjectAccess(authCtx, project.owner);
    }
    return exportEntitiesCsv(context.db, workspace, authCtx, query);
  }),

  downloadTemplate: entityRouter.entities.downloadTemplate.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    return downloadEntityImportTemplate(context.db, workspace, authCtx, input.params.schemaId);
  })
};

export const workspaceEntityORPCRouter = entityRouter.router({
  entityQueryText: entityQueryTextHandlers,
  entities: {
    ...entityHandlers,
    ...entityTransferHandlers
  }
});

export const workspaceEntityOpenAPIHandler = new OpenAPIHandler(workspaceEntityORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceEntityORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceEntityOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
