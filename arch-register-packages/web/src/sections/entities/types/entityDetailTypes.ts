import type { EntitySummary } from '@arch-register/api-types/entityContract';

// A schema's configurable detail layout (schemaContract.ts DetailLayoutConfig) contributes its
// own tab ids here too — those are arbitrary per-schema strings, not part of the fixed set below.
// `(string & {})` keeps autocomplete for the known ids while still allowing any string.
export type TabId =
  | 'overview'
  | 'api'
  | 'topology'
  | 'graph'
  | 'relations'
  | 'future-plans'
  | 'related-content'
  | 'dependents'
  | 'assessments'
  | 'discussions'
  | 'changes'
  | 'timeline'
  | (string & {});

// Sidebar groups: each maps to a single sidebar entry whose page shows these as sub-tabs.
// 'overview' is the fallback home tab id when a schema has no configurable detail layout tabs;
// the entity detail screen also folds in the current schema's actual layout tab ids at runtime.
export const HOME_TAB_IDS: readonly TabId[] = ['overview', 'relations', 'future-plans', 'changes'];
export const API_TAB_IDS: readonly TabId[] = ['api'];
export const CONTEXT_TAB_IDS: readonly TabId[] = [
  'topology',
  'graph',
  'dependents',
  'related-content'
];
export const COLLABORATION_TAB_IDS: readonly TabId[] = ['discussions'];
export const PLANNING_TAB_IDS: readonly TabId[] = ['assessments', 'timeline'];

export type Relation = {
  entityId: string;
  publicId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  fieldPredicate?: string;
  kind: 'reference' | 'containment' | 'typed';
  relationId?: string;
  relationSchemaId?: string;
  relationSchemaColor?: string | null;
  relationSchemaIcon?: string | null;
  relationFields?: Record<string, unknown>;
};

export type RelationGroup = {
  key: string;
  label: string;
  relations: Relation[];
};

export type RefLookup = Map<string, EntitySummary>;
