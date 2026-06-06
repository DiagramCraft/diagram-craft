import type { EntityCapabilities, EntityLink, LifecycleStatus, VisibilityMode } from './common.js';

// ── Entity Types ──────────────────────────────────────────────

export type EntitySummary = EntityCapabilities & {
  _uid: string;
  _workspace: string;
  _schemaId: string;
  _name: string;
  _slug: string;
  _namespace: string;
  _description: string;
  _owner: string | null;
  _lifecycle: LifecycleStatus | null;
  _tags: string[];
  _links: EntityLink[];
  _visibilityMode: VisibilityMode | null;
  _completeness: number | null;
};

export type EntityRecord = EntitySummary & {
  [key: string]: unknown;
};

// ── Request Types ─────────────────────────────────────────────

export type CreateEntityRequest = {
  _schemaId: string;
  _name?: string;
  _slug?: string;
  _namespace?: string;
  _description?: string;
  _owner?: string | null;
  _lifecycle?: LifecycleStatus | null;
  _tags?: string[];
  _links?: EntityLink[];
  _visibilityMode?: VisibilityMode | null;
  [key: string]: unknown;
};

export type UpdateEntityRequest = CreateEntityRequest;

// ── Facets ────────────────────────────────────────────────────

export type EntityFacetBucket = {
  value: string | null;
  count: number;
};

export type EntitySchemaFacetBucket = {
  schemaId: string;
  count: number;
};

export type EntityFacets = {
  total: number;
  lifecycle: EntityFacetBucket[];
  owner: EntityFacetBucket[];
  schema: EntitySchemaFacetBucket[];
  completeness: { below50: number; below80: number; above80: number };
};

// ── Relations ─────────────────────────────────────────────────

export type EntityRelation = {
  entityId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  kind: 'reference' | 'containment';
};

export type EntityRelations = {
  outgoing: EntityRelation[];
  incoming: EntityRelation[];
};

// ── Tree Response ─────────────────────────────────────────────

export type TreeNode = EntitySummary & { _isMatch: boolean };

export type TreeEdge = { childId: string; parentId: string };

export type TreeResponse = {
  nodes: TreeNode[];
  edges: TreeEdge[];
};

// ── Search Result ─────────────────────────────────────────────

export type EntitySearchResult = {
  entityId: string;
  schemaId: string;
  schemaName: string;
  _name: string;
  _slug: string;
  _description: string;
  _owner: string | null;
  _lifecycle: LifecycleStatus | null;
  matchedFields: string[];
  matchedMetadata: string[];
};
