import type { EntitySummary } from '@arch-register/api-types/entityContract';

export type TabId =
  | 'overview'
  | 'topology'
  | 'graph'
  | 'relations'
  | 'related-content'
  | 'dependents'
  | 'assessments'
  | 'discussions'
  | 'changes'
  | 'timeline';

// Sidebar groups: each maps to a single sidebar entry whose page shows these as sub-tabs.
export const HOME_TAB_IDS: readonly TabId[] = ['overview', 'relations', 'changes'];
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
  kind: 'reference' | 'containment';
};

export type RelationGroup = {
  key: string;
  label: string;
  relations: Relation[];
};

export type RefLookup = Map<string, EntitySummary>;
