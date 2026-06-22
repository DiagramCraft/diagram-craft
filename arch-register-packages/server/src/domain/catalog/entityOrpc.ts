import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter, EntityDbUpdate } from '../../db/database';
import {
  buildApiAuthCtx,
  filterVisibleEntities,
  requireEntityAction,
  requireProjectAccess,
  requireSchemaRead
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { orpcAssert } from '../../utils/orpcAssert';
import { buildEntityGrantInputs, filterEntities, relationFields } from './dataHelpers';
import type { EntitySnapshotDbResult } from './db/catalogDatabase';
import { updateEntityWithAudit } from './entityMutations';

const serializeSnapshot = (s: EntitySnapshotDbResult) => ({
  ...s,
  created_at: s.created_at.toISOString(),
  created_by_name: s.created_by_name,
  target_date:
    (s.target_date as unknown) instanceof Date
      ? (s.target_date as unknown as Date).toISOString().slice(0, 10)
      : s.target_date
});
import { importParse, importCommit } from './importOperations';
import { generateCsv, formatArrayForCsv } from '../../utils/csv';
import { decodeRefs } from '../../types';
import {
  listEntities,
  getEntityFacets,
  getEntityTree,
  getEntity,
  getEntityRelations,
  getBatchEntityRelations,
  createEntity,
  updateEntity,
  cloneEntity,
  deleteEntity
} from './entityOperations';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const entityRouter = implement(workspaceEntityContract).$context<ORPCContext>();

export const workspaceEntityORPCRouter = entityRouter.router({
  entities: {
    list: entityRouter.entities.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await listEntities(context.db, workspace, authCtx, {
          schemaId: input.query._schemaId ?? null,
          owner: input.query.owner ?? null,
          lifecycle: input.query.lifecycle ?? null,
          q: input.query.q ?? '',
          view: input.query.view ?? 'full',
          limit: input.query.limit ?? null,
          offset: input.query.offset ?? 0
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    facets: entityRouter.entities.facets.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntityFacets(context.db, workspace, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    tree: entityRouter.entities.tree.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntityTree(context.db, workspace, authCtx, {
          schemaId: input.query._schemaId ?? null,
          owner: input.query.owner ?? null,
          lifecycle: input.query.lifecycle ?? null,
          q: input.query.q ?? ''
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    get: entityRouter.entities.get.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntity(context.db, workspace, input.params.id, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    relations: entityRouter.entities.relations.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntityRelations(context.db, workspace, input.params.id, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    batchRelations: entityRouter.entities.batchRelations.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getBatchEntityRelations(context.db, workspace, input.body.ids, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    create: entityRouter.entities.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await createEntity(
          context.db,
          workspace,
          input.body as Record<string, unknown>,
          authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),

    update: entityRouter.entities.update.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await updateEntity(
          context.db,
          workspace,
          input.params.id,
          input.body as Record<string, unknown>,
          authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),

    clone: entityRouter.entities.clone.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await cloneEntity(context.db, workspace, input.params.id, authCtx, {
          id: auditUser.id,
          displayName: auditUser.display_name
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    remove: entityRouter.entities.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await deleteEntity(context.db, workspace, input.params.id, authCtx, {
          id: auditUser.id,
          displayName: auditUser.display_name
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    getAccess: entityRouter.entities.getAccess.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
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
          visibility_mode: entity.visibility_mode,
          grants: grants.map(g => ({ ...g, created_at: g.created_at.toISOString() }))
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    updateAccess: entityRouter.entities.updateAccess.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
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
        return {
          owner: entity.owner,
          visibility_mode: entity.visibility_mode,
          grants: grants.map(g => ({ ...g, created_at: g.created_at.toISOString() }))
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    importParse: entityRouter.entities.importParse.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await importParse(context.db, authCtx, {
          workspace,
          schemaId: input.body.schemaId,
          csvContent: input.body.csvContent
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    importCommit: entityRouter.entities.importCommit.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await importCommit(context.db, authCtx, {
          workspace,
          schemaId: input.body.schemaId,
          entities: input.body.entities as Array<
            Record<string, unknown> & { _existingId?: string }
          >,
          auditUser: { id: auditUser.id, display_name: auditUser.display_name }
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    exportCsv: entityRouter.entities.exportCsv.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const schemaId = input.query._schemaId ?? null;
        const owner = input.query.owner ?? null;
        const lifecycle = input.query.lifecycle ?? null;
        const q = input.query.q ?? '';

        const [schemas, allEntitiesRaw] = await Promise.all([
          context.db.catalog.listSchemas(workspace),
          context.db.catalog.listEntities(workspace)
        ]);

        const allEntities = filterVisibleEntities(authCtx, allEntitiesRaw);
        const schemaMap = new Map(schemas.map(s => [s.id, s]));
        const entities = filterEntities(allEntities, { schemaId, owner, lifecycle, q }).sort(
          (a, b) => a.name.localeCompare(b.name)
        );

        let csvContent: string;
        if (schemaId) {
          const schema = schemaMap.get(schemaId);
          orpcAssert.present(schema, { code: 'NOT_FOUND', message: 'Schema not found' });

          const refFields = relationFields(schema.fields);
          const allRefIds = new Set<string>();
          for (const entity of entities) {
            for (const field of refFields) {
              decodeRefs(entity.data[field.id]).forEach(id => allRefIds.add(id));
            }
          }
          const refLookup = new Map(
            allEntities
              .filter(entity => allRefIds.has(entity.id))
              .map(entity => [entity.id, entity.name || entity.slug])
          );

          const columns = [
            'ID',
            'Name',
            'Slug',
            'Namespace',
            'Description',
            'Owner',
            'Lifecycle',
            'Target Lifecycle',
            'Target Date',
            'Tags',
            'Links',
            'Schema Type',
            ...schema.fields.map(f => f.name)
          ];

          const rows = entities.map(entity => {
            const row: Record<string, unknown> = {
              'ID': entity.id,
              'Name': entity.name,
              'Slug': entity.slug,
              'Namespace': entity.namespace,
              'Description': entity.description,
              'Owner': entity.owner ?? '',
              'Lifecycle': entity.lifecycle ?? '',
              'Target Lifecycle': entity.target_lifecycle ?? '',
              'Target Date': entity.target_lifecycle_date ?? '',
              'Tags': formatArrayForCsv(entity.tags),
              'Links': entity.links.length.toString(),
              'Schema Type': schema.name
            };
            for (const field of schema.fields) {
              const value = entity.data[field.id];
              if (field.type === 'reference' || field.type === 'containment') {
                row[field.name] = formatArrayForCsv(
                  decodeRefs(value).map(id => refLookup.get(id) ?? id)
                );
              } else if (field.type === 'boolean') {
                row[field.name] = value === true ? 'true' : value === false ? 'false' : '';
              } else if (Array.isArray(value)) {
                row[field.name] = formatArrayForCsv(value);
              } else {
                row[field.name] = value ?? '';
              }
            }
            return row;
          });
          csvContent = generateCsv(rows, columns, ';');
        } else {
          const columns = [
            'ID',
            'Name',
            'Slug',
            'Namespace',
            'Description',
            'Owner',
            'Lifecycle',
            'Target Lifecycle',
            'Target Date',
            'Tags',
            'Links',
            'Schema Type'
          ];
          const rows = entities.map(entity => ({
            'ID': entity.id,
            'Name': entity.name,
            'Slug': entity.slug,
            'Namespace': entity.namespace,
            'Description': entity.description,
            'Owner': entity.owner ?? '',
            'Lifecycle': entity.lifecycle ?? '',
            'Target Lifecycle': entity.target_lifecycle ?? '',
            'Target Date': entity.target_lifecycle_date ?? '',
            'Tags': formatArrayForCsv(entity.tags),
            'Links': entity.links.length.toString(),
            'Schema Type': schemaMap.get(entity.schema_id)?.name ?? entity.schema_id
          }));
          csvContent = generateCsv(rows, columns, ';');
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const schemaName = schemaId
          ? schemaMap.get(schemaId)?.name.toLowerCase().replace(/\s+/g, '-')
          : 'entities';
        const filename = `${schemaName}-${timestamp}.csv`;

        return {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="${filename}"`
          },
          body: new Blob([csvContent], { type: 'text/csv; charset=utf-8' })
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    downloadTemplate: entityRouter.entities.downloadTemplate.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireSchemaRead(authCtx);

        const schema = await context.db.catalog.getSchema(workspace, input.params.schemaId);
        orpcAssert.present(schema, { code: 'NOT_FOUND', message: 'Schema not found' });

        const columns = [
          'ID',
          'Name',
          'Slug',
          'Namespace',
          'Description',
          'Owner',
          'Lifecycle',
          'Tags',
          ...schema.fields.map(f => f.name)
        ];
        const csvContent = columns.map(col => `"${col}"`).join(';');

        const filename = `${schema.name.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`;

        return {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="${filename}"`
          },
          body: new Blob([csvContent], { type: 'text/csv; charset=utf-8' })
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    snapshots: {
      list: entityRouter.entities.snapshots.list.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
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
          const snapshots = await context.db.catalog.listSnapshots(workspace, entity.id);
          return snapshots.map(serializeSnapshot);
        } catch (error) {
          return toORPCError(error);
        }
      }),

      listByProject: entityRouter.entities.snapshots.listByProject.handler(
        async ({ input, context }) => {
          try {
            const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
            const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
            const project = await context.db.project.getProject(workspace, input.params.projectId);
            orpcAssert.present(project, { code: 'NOT_FOUND', message: 'Project not found' });
            requireProjectAccess(
              authCtx,
              project.owner,
              'You do not have permission to view snapshots for this project'
            );

            const [snapshots, entities] = await Promise.all([
              context.db.catalog.listSnapshotsByProject(workspace, project.id),
              context.db.catalog.listEntities(workspace)
            ]);
            const visibleEntityIds = new Set(
              filterVisibleEntities(authCtx, entities).map(e => e.id)
            );

            return snapshots
              .filter(snapshot => visibleEntityIds.has(snapshot.entity_id))
              .map(serializeSnapshot);
          } catch (error) {
            return toORPCError(error);
          }
        }
      ),

      create: entityRouter.entities.snapshots.create.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
          const entity = await context.db.catalog.getEntity(workspace, input.params.id);
          httpAssert.present(entity, {
            status: 404,
            message: `Data record '${input.params.id}' not found`
          });
          requireEntityAction(
            authCtx,
            entity,
            'edit_entity',
            'You do not have permission to edit this entity'
          );
          const project = await context.db.project.getProject(workspace, input.body.projectId);
          orpcAssert.present(project, { code: 'NOT_FOUND', message: 'Project not found' });

          const snapshot = await context.db.catalog.createSnapshot({
            id: crypto.randomUUID(),
            workspace,
            entity_id: entity.id,
            status: 'future_update',
            project_id: project.id,
            target_date: input.body.targetDate ?? null,
            commit_message: input.body.commitMessage ?? null,
            created_at: new Date(),
            created_by: context.event.context.user.id,
            created_by_name: context.event.context.user.display_name,
            base_state: {
              id: entity.id,
              workspace: entity.workspace,
              slug: entity.slug,
              namespace: entity.namespace,
              name: entity.name,
              description: entity.description,
              owner: entity.owner,
              lifecycle: entity.lifecycle,
              target_lifecycle: entity.target_lifecycle,
              target_lifecycle_date: entity.target_lifecycle_date,
              tags: entity.tags,
              links: entity.links,
              schema_id: entity.schema_id,
              data: entity.data,
              visibility_mode: entity.visibility_mode
            },
            proposed_state: input.body.proposedState
          });
          return serializeSnapshot(snapshot);
        } catch (error) {
          return toORPCError(error);
        }
      }),

      update: entityRouter.entities.snapshots.update.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
          const entity = await context.db.catalog.getEntity(workspace, input.params.id);
          httpAssert.present(entity, {
            status: 404,
            message: `Data record '${input.params.id}' not found`
          });
          requireEntityAction(
            authCtx,
            entity,
            'edit_entity',
            'You do not have permission to edit this entity'
          );
          const snapshot = await context.db.catalog.updateSnapshot(
            workspace,
            input.params.snapshotId,
            {
              proposed_state: input.body.proposedState,
              target_date: input.body.targetDate,
              commit_message: input.body.commitMessage
            }
          );
          orpcAssert.present(snapshot, {
            code: 'NOT_FOUND',
            message: 'Snapshot not found or is not a future_update snapshot'
          });
          return serializeSnapshot(snapshot);
        } catch (error) {
          return toORPCError(error);
        }
      }),

      promote: entityRouter.entities.snapshots.promote.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
          const entity = await context.db.catalog.getEntity(workspace, input.params.id);
          httpAssert.present(entity, {
            status: 404,
            message: `Data record '${input.params.id}' not found`
          });
          requireEntityAction(
            authCtx,
            entity,
            'edit_entity',
            'You do not have permission to edit this entity'
          );
          const snapshot = await context.db.catalog.promoteSnapshot(
            workspace,
            input.params.snapshotId,
            input.body.commitMessage ?? null
          );
          orpcAssert.present(snapshot, {
            code: 'NOT_FOUND',
            message: 'Snapshot not found or is not an autosave snapshot'
          });
          return serializeSnapshot(snapshot);
        } catch (error) {
          return toORPCError(error);
        }
      }),

      apply: entityRouter.entities.snapshots.apply.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
          const entity = await context.db.catalog.getEntity(workspace, input.params.id);
          httpAssert.present(entity, {
            status: 404,
            message: `Data record '${input.params.id}' not found`
          });
          requireEntityAction(
            authCtx,
            entity,
            'edit_entity',
            'You do not have permission to edit this entity'
          );
          const existing = await context.db.catalog.listSnapshots(workspace, entity.id);
          const snapshot = existing.find(s => s.id === input.params.snapshotId);
          orpcAssert.present(snapshot, {
            code: 'NOT_FOUND',
            message: 'Snapshot not found'
          });
          orpcAssert.true(snapshot.status === 'future_update', {
            code: 'BAD_REQUEST',
            message: 'Only future_update snapshots can be applied'
          });

          const auditUser = context.event.context.user;
          await updateEntity(
            context.db,
            workspace,
            entity.id,
            input.body.resolvedEntityData,
            authCtx,
            { id: auditUser.id, displayName: auditUser.display_name }
          );

          const applied = await context.db.catalog.applySnapshot(
            workspace,
            input.params.snapshotId
          );
          orpcAssert.present(applied, {
            code: 'NOT_FOUND',
            message: 'Failed to apply snapshot'
          });
          return serializeSnapshot(applied);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      restore: entityRouter.entities.snapshots.restore.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);

          const entity = await context.db.catalog.getEntity(workspace, input.params.id);
          orpcAssert.present(entity, {
            code: 'NOT_FOUND',
            message: 'Entity not found'
          });

          if (authCtx) {
            requireEntityAction(
              authCtx,
              entity,
              'edit_entity',
              'You do not have permission to restore this entity'
            );
          }

          const snapshot = await context.db.catalog.getSnapshot(workspace, input.params.snapshotId);
          orpcAssert.present(snapshot, { code: 'NOT_FOUND', message: 'Snapshot not found' });
          orpcAssert.true(snapshot.entity_id === entity.id, {
            code: 'BAD_REQUEST',
            message: 'Snapshot does not belong to this entity'
          });
          orpcAssert.true(
            snapshot.status === 'autosave' ||
              snapshot.status === 'saved_version' ||
              snapshot.status === 'applied',
            {
              code: 'BAD_REQUEST',
              message: 'Only autosave, saved_version, or applied snapshots can be restored'
            }
          );

          const auditUser = context.event.context.user;
          await updateEntityWithAudit(context.db, {
            workspace,
            entityId: entity.id,
            previous: entity,
            next: {
              ...snapshot.base_state,
              updated_at: new Date()
            } as EntityDbUpdate,
            actor: { id: auditUser.id, displayName: auditUser.display_name },
            auditMetadata: {
              restore_from_snapshot_id: snapshot.id,
              restore_from_snapshot_created_at: snapshot.created_at.toISOString(),
              restore_commit_message: input.body.commitMessage ?? null
            }
          });

          return serializeSnapshot(snapshot);
        } catch (error) {
          return toORPCError(error);
        }
      })
    }
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
