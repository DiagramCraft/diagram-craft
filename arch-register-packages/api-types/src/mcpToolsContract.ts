import { z } from 'zod';
import { filterConditionSchema } from './viewContract';

const boundedLimit = z.number().int().min(1).max(50).default(20);
const boundedOffset = z.number().int().min(0).default(0);

export const mcpSearchEntitiesInput = z.object({
  query: z.string().optional(),
  schemaId: z.string().optional(),
  owner: z.string().optional(),
  lifecycle: z.string().optional(),
  conditions: z.array(filterConditionSchema).optional(),
  limit: boundedLimit,
  offset: boundedOffset
});

export const mcpGetEntityInput = z
  .object({
    entityId: z.string().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
    includeRelated: z.boolean().default(true)
  })
  .refine(
    value => [value.entityId, value.slug, value.name].filter(item => item != null).length === 1,
    'Exactly one of entityId, slug, or name is required'
  );

export const mcpListSchemasInput = z.object({});

export const mcpRelationTraversalInput = z.object({
  entityId: z.string(),
  depth: z.number().int().min(1).max(5).default(1),
  transitive: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(100)
});

export const mcpWorkspaceSummaryInput = z.object({});

export const mcpCreateEntityInput = z.object({
  schemaId: z.string(),
  name: z.string().optional(),
  slug: z.string().optional(),
  namespace: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().nullable().optional(),
  lifecycle: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  fields: z.record(z.string(), z.unknown()).optional()
});

export const mcpUpdateEntityInput = mcpCreateEntityInput.extend({ entityId: z.string() }).partial({
  schemaId: true,
  name: true,
  slug: true,
  namespace: true,
  description: true,
  owner: true,
  lifecycle: true,
  tags: true,
  fields: true
});

export const mcpUpdateEntityFieldInput = z.object({
  entityId: z.string(),
  fieldId: z
    .string()
    .min(1)
    .refine(value => !value.startsWith('_'), 'Schema field IDs cannot start with an underscore'),
  value: z.unknown()
});

export type McpSearchEntitiesInput = z.infer<typeof mcpSearchEntitiesInput>;
export type McpGetEntityInput = z.infer<typeof mcpGetEntityInput>;
export type McpRelationTraversalInput = z.infer<typeof mcpRelationTraversalInput>;
export type McpCreateEntityInput = z.infer<typeof mcpCreateEntityInput>;
export type McpUpdateEntityInput = z.infer<typeof mcpUpdateEntityInput>;
export type McpUpdateEntityFieldInput = z.infer<typeof mcpUpdateEntityFieldInput>;

export type McpEntitySummary = {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  schemaId: string;
  schemaName: string;
  description: string;
  owner: { id: string; name: string } | null;
  lifecycle: { id: string; name: string } | null;
  tags: string[];
  data: Record<string, unknown>;
};

export type McpRelation = {
  entityId: string;
  publicId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  fieldPredicate?: string;
  kind: 'reference' | 'containment';
};

export type McpEntityDetails = McpEntitySummary & {
  namespace: string;
  links: Array<{ url: string; title: string; type?: string }>;
  projectId: string | null;
  schemaFields: unknown[];
  fields: Record<string, unknown>;
  outgoingRelations: McpRelation[];
  incomingRelations: McpRelation[];
};

export type McpToolError = {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT' | 'UPSTREAM';
  message: string;
};
