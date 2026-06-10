import type { z } from 'zod';
import type { EntityLink, ForeignKey, VisibilityMode } from './common.js';
import type {
  entityFacetBucketSchema,
  entityFacetsSchema,
  entityRecordSchema,
  entityRelationSchema,
  entityRelationsSchema,
  entitySummarySchema,
  treeEdgeSchema,
  treeNodeSchema,
  treeResponseSchema
} from './entityContract.js';

// ── Entity Types ──────────────────────────────────────────────

export type EntitySummary = z.infer<typeof entitySummarySchema>;

export type EntityRecord = z.infer<typeof entityRecordSchema>;

// ── Request Types ─────────────────────────────────────────────

export type CreateEntityRequest = {
  _schemaId: string;
  _name?: string;
  _slug?: string;
  _namespace?: string;
  _description?: string;
  _owner?: string | null;
  _lifecycle?: string | null;
  _targetLifecycle?: string | null;
  _targetLifecycleDate?: string | null;
  _tags?: string[];
  _links?: EntityLink[];
  _visibilityMode?: VisibilityMode | null;
  [key: string]: unknown;
};

export type UpdateEntityRequest = CreateEntityRequest;

// ── Facets ────────────────────────────────────────────────────

export type EntityFacetBucket = z.infer<typeof entityFacetBucketSchema>;

export type EntityFacets = z.infer<typeof entityFacetsSchema>;

export type EntitySchemaFacetBucket = EntityFacets['schema'][number];

// ── Relations ─────────────────────────────────────────────────

export type EntityRelation = z.infer<typeof entityRelationSchema>;

export type EntityRelations = z.infer<typeof entityRelationsSchema>;

// ── Tree Response ─────────────────────────────────────────────

export type TreeNode = z.infer<typeof treeNodeSchema>;

export type TreeEdge = z.infer<typeof treeEdgeSchema>;

export type TreeResponse = z.infer<typeof treeResponseSchema>;

// ── Search Result ─────────────────────────────────────────────

export type EntitySearchResult = {
  entityId: string;
  schemaId: string;
  schemaName: string;
  _name: string;
  _slug: string;
  _description: string;
  _owner: ForeignKey | null;
  _lifecycle: ForeignKey | null;
  _targetLifecycle: ForeignKey | null;
  matchedFields: string[];
  matchedMetadata: string[];
};
