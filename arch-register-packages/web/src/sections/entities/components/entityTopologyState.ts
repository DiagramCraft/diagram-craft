import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import type { Relation, RelationGroup } from '../types/entityDetailTypes';

export const groupRelationsByField = (relations: Relation[]): RelationGroup[] => {
  const groups = new Map<string, RelationGroup>();
  for (const relation of relations) {
    const group = groups.get(relation.fieldName);
    if (group) {
      group.relations.push(relation);
    } else {
      groups.set(relation.fieldName, {
        key: relation.fieldName,
        label: getRelationDisplayLabel(relation),
        relations: [relation]
      });
    }
  }
  return [...groups.values()];
};
