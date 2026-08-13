import { toolDefinition } from '@tanstack/ai';
import { randomUUID } from 'node:crypto';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import { requireWorkspaceCapability } from '../auth/authorization';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import {
  assertRelationMutationsSupported,
  assertTypedRelationCardinality,
  flattenRelationAuditFields,
  validateRelationEndpoints
} from '../catalog/relationHelpers';
import { canViewTypedRelation, requireTypedRelationEdit } from '../catalog/relationAccessControl';
import {
  getRelationEndpointAccess,
  listAllRelationRows,
  loadRelationEndpointAccess,
  loadVisibleRelationEndpoints,
  relationSchemaMap,
  toAiRelation
} from './chatToolHelpers';
import type { AiChatToolContext } from './chatToolContext';

type ListRelationsArgs = {
  schemaId?: string;
  inEntityId?: string;
  outEntityId?: string;
  limit?: number;
  offset?: number;
};

type GetRelationArgs = { relationId: string };

type CreateRelationArgs = {
  schemaId: string;
  inEntityId: string;
  outEntityId: string;
  fields?: Record<string, unknown>;
};

type UpdateRelationArgs = { relationId: string; fields: Record<string, unknown> };
type DeleteRelationArgs = { relationId: string };

const relationOutputSchema = {
  type: 'object',
  additionalProperties: true
};

const listRelationSchemasTool = toolDefinition({
  name: 'list_relation_schemas',
  description: 'List typed relation schemas, endpoint constraints, fields, groups, and metadata.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  outputSchema: { type: 'array', items: relationOutputSchema }
});

const listRelationsTool = toolDefinition({
  name: 'list_relations',
  description:
    'List visible typed relation instances with optional endpoint filters and pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      schemaId: { type: 'string' },
      inEntityId: { type: 'string' },
      outEntityId: { type: 'string' },
      limit: { type: 'number', minimum: 1, maximum: 100 },
      offset: { type: 'number', minimum: 0 }
    },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      items: { type: 'array', items: relationOutputSchema },
      total: { type: 'number' }
    },
    required: ['items', 'total'],
    additionalProperties: false
  }
});

const getRelationTool = toolDefinition({
  name: 'get_relation',
  description: 'Get one visible typed relation instance by ID.',
  inputSchema: {
    type: 'object',
    properties: { relationId: { type: 'string' } },
    required: ['relationId'],
    additionalProperties: false
  },
  outputSchema: relationOutputSchema
});

const createRelationTool = toolDefinition({
  name: 'create_relation',
  description: 'Create a typed relation instance between two entities; requires explicit approval.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: {
      schemaId: { type: 'string' },
      inEntityId: { type: 'string' },
      outEntityId: { type: 'string' },
      fields: { type: 'object', additionalProperties: true }
    },
    required: ['schemaId', 'inEntityId', 'outEntityId'],
    additionalProperties: false
  },
  outputSchema: relationOutputSchema
});

const updateRelationTool = toolDefinition({
  name: 'update_relation',
  description: 'Update typed relation fields; requires explicit approval.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: {
      relationId: { type: 'string' },
      fields: { type: 'object', additionalProperties: true }
    },
    required: ['relationId', 'fields'],
    additionalProperties: false
  },
  outputSchema: relationOutputSchema
});

const deleteRelationTool = toolDefinition({
  name: 'delete_relation',
  description: 'Delete a typed relation instance; requires explicit approval.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: { relationId: { type: 'string' } },
    required: ['relationId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: { success: { type: 'boolean' } },
    required: ['success']
  }
});

const createListRelationSchemasTool = (context: AiChatToolContext) =>
  listRelationSchemasTool.server(async () => {
    const schemas = await context.db.relation.listRelationSchemas(context.workspaceId);
    return schemas;
  });

const createListRelationsTool = (context: AiChatToolContext) =>
  listRelationsTool.server(async rawArgs => {
    const args = rawArgs as ListRelationsArgs;
    const schemaMap = await relationSchemaMap(context);
    const { entityMap, schemaMap: entitySchemaMap } = await loadVisibleRelationEndpoints(context);
    const rows = await listAllRelationRows(context, {
      schemaId: args.schemaId ?? null,
      inEntityId: args.inEntityId ?? null,
      outEntityId: args.outEntityId ?? null
    });
    const visibleRows = rows.filter(row => {
      const access = getRelationEndpointAccess(
        entityMap.get(row.in_entity_id) ?? null,
        entityMap.get(row.out_entity_id) ?? null,
        entitySchemaMap
      );
      return (
        access.inEntity !== null &&
        access.outEntity !== null &&
        canViewTypedRelation(context.authCtx, access.endpoints, row.schema_id)
      );
    });
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 20), 1), 100);
    const offset = Math.max(Math.trunc(args.offset ?? 0), 0);
    return {
      total: visibleRows.length,
      items: visibleRows
        .slice(offset, offset + limit)
        .map(row => toAiRelation(row, context.authCtx, schemaMap))
        .filter(Boolean)
    };
  });

const createGetRelationTool = (context: AiChatToolContext) =>
  getRelationTool.server(async rawArgs => {
    const args = rawArgs as GetRelationArgs;
    const row = await context.db.relation.getRelation(context.workspaceId, args.relationId);
    if (!row) throw new Error(`Relation '${args.relationId}' not found`);
    const { entityMap, schemaMap: entitySchemaMap } = await loadVisibleRelationEndpoints(context);
    const access = getRelationEndpointAccess(
      entityMap.get(row.in_entity_id) ?? null,
      entityMap.get(row.out_entity_id) ?? null,
      entitySchemaMap
    );
    if (
      access.inEntity === null ||
      access.outEntity === null ||
      !canViewTypedRelation(context.authCtx, access.endpoints, row.schema_id)
    ) {
      throw new Error(`Relation '${args.relationId}' not found`);
    }
    const schemaMap = await relationSchemaMap(context);
    const result = toAiRelation(row, context.authCtx, schemaMap);
    if (!result) throw new Error(`Relation '${args.relationId}' not found`);
    return result;
  });

const createCreateRelationTool = (context: AiChatToolContext) =>
  createRelationTool.server(async rawArgs => {
    const args = rawArgs as CreateRelationArgs;
    if (context.authCtx) requireWorkspaceCapability(context.authCtx, 'ent.edit');
    const schema = await context.db.relation.getRelationSchema(context.workspaceId, args.schemaId);
    if (!schema) throw new Error(`Relation schema '${args.schemaId}' not found`);
    // Creating a relation instance is never gated on approval policy, mirroring entity create.
    const endpointAccess = await loadRelationEndpointAccess(
      context,
      args.inEntityId,
      args.outEntityId
    );
    validateRelationEndpoints(schema, endpointAccess.inEntity, endpointAccess.outEntity);
    if (context.authCtx)
      requireTypedRelationEdit(context.authCtx, endpointAccess.endpoints, schema.id);
    const fields = args.fields ?? {};
    if (context.authCtx)
      requireNoRestrictedFieldWrites(context.authCtx, schema, Object.keys(fields));
    const now = new Date();
    await assertTypedRelationCardinality(context.db, context.workspaceId, [
      {
        relationSchemaId: schema.id,
        inEntityId: endpointAccess.inEntity!.id,
        outEntityId: endpointAccess.outEntity!.id,
        delta: 1
      }
    ]);
    const row = await context.db.relation.createRelation({
      id: randomUUID(),
      workspace: context.workspaceId,
      schema_id: schema.id,
      in_entity_id: endpointAccess.inEntity!.id,
      out_entity_id: endpointAccess.outEntity!.id,
      data: fields,
      created_at: now,
      updated_at: now
    });
    await logAudit(context.db, {
      userId: context.actor.id,
      userDisplayName: context.actor.displayName,
      workspace: context.workspaceId,
      operation: 'create',
      entityType: 'relation',
      entityId: row.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: { new: flattenRelationAuditFields(row) }
    });
    return toAiRelation(row, context.authCtx, new Map([[schema.id, schema]]));
  });

const createUpdateRelationTool = (context: AiChatToolContext) =>
  updateRelationTool.server(async rawArgs => {
    const args = rawArgs as UpdateRelationArgs;
    if (context.authCtx) requireWorkspaceCapability(context.authCtx, 'ent.edit');
    const oldRow = await context.db.relation.getRelation(context.workspaceId, args.relationId);
    if (!oldRow) throw new Error(`Relation '${args.relationId}' not found`);
    const schema = await context.db.relation.getRelationSchema(
      context.workspaceId,
      oldRow.schema_id
    );
    if (!schema) throw new Error(`Relation schema '${oldRow.schema_id}' not found`);
    assertRelationMutationsSupported(schema, oldRow);
    const endpointAccess = await loadRelationEndpointAccess(
      context,
      oldRow.in_entity_id,
      oldRow.out_entity_id
    );
    if (context.authCtx) {
      requireTypedRelationEdit(context.authCtx, endpointAccess.endpoints, oldRow.schema_id);
    }
    const changed = Object.keys(args.fields).filter(
      key => JSON.stringify(oldRow.data[key] ?? null) !== JSON.stringify(args.fields[key] ?? null)
    );
    if (context.authCtx) requireNoRestrictedFieldWrites(context.authCtx, schema, changed);
    const row = await context.db.relation.updateRelation(context.workspaceId, oldRow.id, {
      data: { ...oldRow.data, ...args.fields },
      version: oldRow.version + 1,
      updated_at: new Date()
    });
    if (!row) throw new Error(`Relation '${args.relationId}' not found`);
    await logAudit(context.db, {
      userId: context.actor.id,
      userDisplayName: context.actor.displayName,
      workspace: context.workspaceId,
      operation: 'update',
      entityType: 'relation',
      entityId: row.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: computeChanges(flattenRelationAuditFields(oldRow), flattenRelationAuditFields(row), {
        alwaysInclude: ['_inEntityId', '_outEntityId']
      })
    });
    return toAiRelation(row, context.authCtx, new Map([[schema.id, schema]]));
  });

const createDeleteRelationTool = (context: AiChatToolContext) =>
  deleteRelationTool.server(async rawArgs => {
    const args = rawArgs as DeleteRelationArgs;
    if (context.authCtx) requireWorkspaceCapability(context.authCtx, 'ent.edit');
    const row = await context.db.relation.getRelation(context.workspaceId, args.relationId);
    if (!row) throw new Error(`Relation '${args.relationId}' not found`);
    const schema = await context.db.relation.getRelationSchema(context.workspaceId, row.schema_id);
    if (!schema) throw new Error(`Relation schema '${row.schema_id}' not found`);
    // Deleting a relation instance is never gated on approval policy, mirroring entity delete.
    const endpointAccess = await loadRelationEndpointAccess(
      context,
      row.in_entity_id,
      row.out_entity_id
    );
    if (context.authCtx)
      requireTypedRelationEdit(context.authCtx, endpointAccess.endpoints, row.schema_id);
    await assertTypedRelationCardinality(context.db, context.workspaceId, [
      {
        relationSchemaId: row.schema_id,
        inEntityId: row.in_entity_id,
        outEntityId: row.out_entity_id,
        delta: -1
      }
    ]);
    await context.db.relation.deleteRelation(context.workspaceId, row.id);
    await logAudit(context.db, {
      userId: context.actor.id,
      userDisplayName: context.actor.displayName,
      workspace: context.workspaceId,
      operation: 'delete',
      entityType: 'relation',
      entityId: row.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: { old: flattenRelationAuditFields(row) }
    });
    return { success: true };
  });

export const createRelationChatTools = (context: AiChatToolContext) => [
  createListRelationSchemasTool(context),
  createListRelationsTool(context),
  createGetRelationTool(context),
  createCreateRelationTool(context),
  createUpdateRelationTool(context),
  createDeleteRelationTool(context)
];
