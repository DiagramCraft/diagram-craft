import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  EntityQuery,
  PathStep,
  ProjectionField,
  QueryNode
} from '@arch-register/api-types/entityQueryIR';

/**
 * A seeded, cross-workspace `EntityBrowserEmbedConfig` authors non-standard (schema) fields by
 * NAME, never by id — a schema's actual field ids are workspace-specific (resolved via capability
 * field-role binding when the schema is instantiated). This module resolves those names against
 * the live workspace's schema at render time, mirroring `dashboardSidebarConfigSchema.schemaName`.
 * Standard fields (`_owner`, `_lifecycle`, ...) and projection ids (`_projection:<alias>`) are
 * never resolved. Scope is deliberately narrow: only a single forward hop (`path.length === 1`,
 * `kind === 'forward'`) is resolved; anything deeper, or already using a real id, passes through
 * unchanged rather than throwing.
 */

export const resolveTableFieldIds = (
  viewConfig: unknown,
  rootSchema: EntitySchema | undefined
): unknown => {
  if (
    !rootSchema ||
    viewConfig == null ||
    typeof viewConfig !== 'object' ||
    !Array.isArray((viewConfig as { fieldIds?: unknown }).fieldIds)
  ) {
    return viewConfig;
  }
  const fieldIds = (viewConfig as { fieldIds: string[] }).fieldIds.map(id => {
    if (id.startsWith('_')) return id;
    return rootSchema.fields.find(field => field.name === id)?.id ?? id;
  });
  return { ...viewConfig, fieldIds };
};

const resolvePathFieldName = (path: PathStep[], rootSchema: EntitySchema): PathStep[] => {
  const [step] = path;
  if (path.length !== 1 || step?.kind !== 'forward') return path;
  const field = rootSchema.fields.find(candidate => candidate.name === step.fieldId);
  return field ? [{ ...step, fieldId: field.id }] : path;
};

const resolveQueryNodeFieldNames = (node: QueryNode, rootSchema: EntitySchema): QueryNode => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return {
        ...node,
        children: node.children.map(child => resolveQueryNodeFieldNames(child, rootSchema))
      };
    case 'not':
      return { ...node, child: resolveQueryNodeFieldNames(node.child, rootSchema) };
    case 'relationExists':
      return { ...node, path: resolvePathFieldName(node.path, rootSchema) };
    case 'predicate':
      if (node.path.length === 0) {
        if (node.fieldId.startsWith('_')) return node;
        const field = rootSchema.fields.find(candidate => candidate.name === node.fieldId);
        return field ? { ...node, fieldId: field.id } : node;
      }
      return { ...node, path: resolvePathFieldName(node.path, rootSchema) };
    default:
      return node;
  }
};

const resolveProjectionFieldNames = (
  projection: ProjectionField,
  rootSchema: EntitySchema
): ProjectionField => ({ ...projection, path: resolvePathFieldName(projection.path, rootSchema) });

/** Resolves every field NAME in an advanced `entityQuery` against the root schema, and pins its
 *  `schemaId` to the already-resolved `typeFilter`. */
export const resolveEntityQuery = (
  query: EntityQuery,
  rootSchema: EntitySchema | undefined,
  typeFilter: string | null
): EntityQuery => {
  if (!rootSchema) return query;
  return {
    ...query,
    schemaId: typeFilter ?? query.schemaId,
    root: resolveQueryNodeFieldNames(query.root, rootSchema),
    projections: query.projections?.map(projection =>
      resolveProjectionFieldNames(projection, rootSchema)
    )
  };
};
