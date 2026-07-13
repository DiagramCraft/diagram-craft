import type { EntityRelation } from '@arch-register/api-types/entityContract';

export const getRelationDisplayLabel = (
  relation: Pick<EntityRelation, 'fieldName' | 'fieldPredicate'>
) => relation.fieldPredicate ?? relation.fieldName;
