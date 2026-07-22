import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery, QueryNode } from '@arch-register/api-types/entityQueryIR';

// Maps today's flat `FilterCondition[]` (an implicit top-level AND of single-entity predicates,
// no traversal) into the structured IR — the degenerate case per specs/QUERY_LANGUAGE.md §5:
// `{ kind: 'predicate', path: [], fieldId, op, value }` for each condition. Reused when saved
// views migrate to the structured query (out of scope for #2326).
export const filterConditionsToEntityQueryIR = (
  schemaId: string | null,
  assessmentId: string | null,
  conditions: FilterCondition[]
): EntityQuery => {
  const root: QueryNode = {
    kind: 'and',
    children: conditions.map(condition => ({
      kind: 'predicate',
      path: [],
      fieldId: condition.fieldId,
      op: condition.op,
      value: condition.value
    }))
  };
  return {
    ...(schemaId ? { schemaId } : {}),
    ...(assessmentId ? { assessmentId } : {}),
    root
  };
};
