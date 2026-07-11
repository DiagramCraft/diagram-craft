import type { EntitySummary } from '@arch-register/api-types/entityContract';

export type TabId =
  | 'overview'
  | 'topology'
  | 'graph'
  | 'relations'
  | 'dependents'
  | 'assessments'
  | 'discussions'
  | 'changes'
  | 'timeline';

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
