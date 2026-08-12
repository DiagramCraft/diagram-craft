import { toolDefinition } from '@tanstack/ai';
import { decodeRefs } from '../../types';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { canViewTypedRelationFromEndpoint } from '../catalog/relationAccessControl';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { getVisibleEntities, relationFields, summarizeRelationTarget } from './chatToolHelpers';
import type { AiChatToolContext } from './chatToolContext';

type TraverseRelationsArgs = {
  entityId: string;
  depth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
};

const traverseRelationsTool = toolDefinition({
  name: 'traverse_relations',
  description:
    'Walk the relation graph from a starting entity up to a given depth. Returns a subgraph of nodes (entities) and edges (relations). Useful for impact analysis, dependency discovery, and finding orphaned entities.',
  inputSchema: {
    type: 'object',
    properties: {
      entityId: { type: 'string' },
      depth: { type: 'number', minimum: 1, maximum: 5 },
      direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'] }
    },
    required: ['entityId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      entityId: { type: 'string' },
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            schemaId: { type: 'string' },
            schemaName: { type: 'string' }
          },
          required: ['id', 'name', 'slug', 'schemaId', 'schemaName'],
          additionalProperties: false
        }
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            targetId: { type: 'string' },
            fieldId: { type: 'string' },
            fieldName: { type: 'string' },
            kind: { type: 'string', enum: ['reference', 'containment', 'typed'] },
            relationId: { type: 'string' },
            relationSchemaId: { type: 'string' },
            relationFields: { type: 'object', additionalProperties: true }
          },
          required: ['sourceId', 'targetId', 'fieldId', 'fieldName', 'kind'],
          additionalProperties: false
        }
      },
      truncated: { type: 'boolean' }
    },
    required: ['entityId', 'nodes', 'edges', 'truncated'],
    additionalProperties: false
  }
});

const createTraverseRelationsTool = (context: AiChatToolContext) =>
  traverseRelationsTool.server(async rawArgs => {
    const args = rawArgs as TraverseRelationsArgs;
    const direction = args.direction ?? 'both';
    const maxDepth = Math.min(Math.max(Math.trunc(args.depth ?? 2), 1), 5);

    const [schemas, rawEntities] = await Promise.all([
      context.db.catalog.listSchemas(context.workspaceId),
      listAllCatalogEntities(context.db, context.workspaceId)
    ]);
    const entities = getVisibleEntities(rawEntities, context.authCtx);
    const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
    const entityMap = new Map(entities.map(entity => [entity.id, entity]));

    const visited = new Set<string>([args.entityId]);
    const nodes = new Map<string, ReturnType<typeof summarizeRelationTarget>>();
    const edgeKeys = new Set<string>();
    const edges: Array<{
      sourceId: string;
      targetId: string;
      fieldId: string;
      fieldName: string;
      kind: string;
    }> = [];

    const queue: Array<{ id: string; depth: number }> = [{ id: args.entityId, depth: 0 }];

    const MAX_NODES = 100;
    let truncated = false;

    const addEdge = (
      sourceId: string,
      targetId: string,
      fieldId: string,
      fieldName: string,
      kind: string
    ) => {
      const key = `${sourceId}:${targetId}:${fieldId}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push({ sourceId, targetId, fieldId, fieldName, kind });
    };

    const canViewTypedRelationAtBothEndpoints = (
      firstEndpointSchema: SchemaDbResult | undefined,
      firstDirection: 'in' | 'out',
      secondEndpointSchema: SchemaDbResult | undefined,
      secondDirection: 'in' | 'out',
      relationSchemaId: string
    ) => {
      if (context.authCtx !== null && (!firstEndpointSchema || !secondEndpointSchema)) return false;
      return (
        canViewTypedRelationFromEndpoint(
          context.authCtx,
          firstEndpointSchema,
          relationSchemaId,
          firstDirection
        ) &&
        canViewTypedRelationFromEndpoint(
          context.authCtx,
          secondEndpointSchema,
          relationSchemaId,
          secondDirection
        )
      );
    };

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift()!;
      const current = entityMap.get(currentId);
      if (!current) continue;

      const schema = schemaMap.get(current.schema_id);
      nodes.set(currentId, summarizeRelationTarget(current, schema?.name));

      if (depth >= maxDepth) continue;

      if (direction === 'outgoing' || direction === 'both') {
        for (const field of relationFields(schema?.fields ?? [])) {
          if (isFieldViewRestricted(context.authCtx, schema, field.id)) continue;
          for (const refId of decodeRefs(current.data[field.id])) {
            addEdge(currentId, refId, field.id, field.name, field.type);
            if (!visited.has(refId)) {
              visited.add(refId);
              if (nodes.size < MAX_NODES) queue.push({ id: refId, depth: depth + 1 });
              else truncated = true;
            }
          }
        }
      }

      if (direction === 'incoming' || direction === 'both') {
        for (const source of entities) {
          if (source.id === currentId) continue;
          const sourceSchema = schemaMap.get(source.schema_id);
          for (const field of relationFields(sourceSchema?.fields ?? [])) {
            if (isFieldViewRestricted(context.authCtx, sourceSchema, field.id)) continue;
            if (!decodeRefs(source.data[field.id]).includes(currentId)) continue;
            addEdge(source.id, currentId, field.id, field.name, field.type);
            if (!visited.has(source.id)) {
              visited.add(source.id);
              if (nodes.size < MAX_NODES) queue.push({ id: source.id, depth: depth + 1 });
              else truncated = true;
            }
          }
        }
      }

      if (direction === 'outgoing' || direction === 'both') {
        const typed = await context.db.relation.listRelationsForEntity(
          context.workspaceId,
          currentId
        );
        for (const relation of typed.outgoing) {
          const targetEntity = entityMap.get(relation.out_entity_id);
          if (!targetEntity) continue;
          const targetSchema = schemaMap.get(targetEntity.schema_id);
          if (
            !canViewTypedRelationAtBothEndpoints(
              schema,
              'in',
              targetSchema,
              'out',
              relation.schema_id
            )
          ) {
            continue;
          }
          const target = targetEntity.id;
          const relationSchema = await context.db.relation.getRelationSchema(
            context.workspaceId,
            relation.schema_id
          );
          addEdge(
            currentId,
            target,
            relation.id,
            relationSchema?.name ?? relation.schema_name,
            'typed'
          );
          if (!visited.has(target)) {
            visited.add(target);
            if (nodes.size < MAX_NODES) queue.push({ id: target, depth: depth + 1 });
            else truncated = true;
          }
        }
      }

      if (direction === 'incoming' || direction === 'both') {
        const typed = await context.db.relation.listRelationsForEntity(
          context.workspaceId,
          currentId
        );
        for (const relation of typed.incoming) {
          const sourceEntity = entityMap.get(relation.in_entity_id);
          if (!sourceEntity) continue;
          const sourceSchema = schemaMap.get(sourceEntity.schema_id);
          if (
            !canViewTypedRelationAtBothEndpoints(
              schema,
              'out',
              sourceSchema,
              'in',
              relation.schema_id
            )
          ) {
            continue;
          }
          const source = sourceEntity.id;
          const relationSchema = await context.db.relation.getRelationSchema(
            context.workspaceId,
            relation.schema_id
          );
          addEdge(
            source,
            currentId,
            relation.id,
            relationSchema?.name ?? relation.schema_name,
            'typed'
          );
          if (!visited.has(source)) {
            visited.add(source);
            if (nodes.size < MAX_NODES) queue.push({ id: source, depth: depth + 1 });
            else truncated = true;
          }
        }
      }
    }

    return {
      entityId: args.entityId,
      nodes: Array.from(nodes.values()),
      edges,
      truncated
    };
  });

export const createTraversalChatTools = (context: AiChatToolContext) => [
  createTraverseRelationsTool(context)
];
