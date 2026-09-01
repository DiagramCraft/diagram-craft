import type { QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { FieldDef } from '../../../../components/FilterBuilder';
import { endpointFieldId, parseEndpointFieldId } from '../../../relations/relationBrowserState';

// Relation-rooted leaves (#2354, plan phase 7 "lean"). The visual builder edits a relation-rooted
// leaf that is either a predicate on the relation's own field (`path: []`) or a predicate one
// `endpoint` hop away on the In/Out entity - the same two shapes `isRelationBasicRepresentable`
// classifies as Basic. It reuses the flat `FilterRow` with the relation field list
// (`getRelationFilterFieldDefs`), where a single `endpoint` hop is encoded into the field id via
// the `in:` / `out:` prefix.

type PredicateNode = Extract<QueryNode, { kind: 'predicate' }>;

/** True when a relation-rooted leaf can render as one flat `FilterRow` (own field, or one
 *  `endpoint` hop). Anything deeper is text-only for now. Not a type guard - a deeper `predicate`
 *  is still a `predicate`, which a `node is PredicateNode` false-branch would wrongly exclude. */
export const isFlatRelationLeaf = (node: QueryNode): boolean =>
  node.kind === 'predicate' &&
  (node.path.length === 0 || (node.path.length === 1 && node.path[0]!.kind === 'endpoint'));

/** The prefixed field id representing a flat relation leaf in the relation field-def list. */
export const relationLeafFieldId = (node: PredicateNode): string => {
  const first = node.path[0];
  return first && first.kind === 'endpoint'
    ? endpointFieldId(first.direction, node.fieldId)
    : node.fieldId;
};

export const relationLeafCondition = (node: PredicateNode): FilterCondition => ({
  fieldId: relationLeafFieldId(node),
  op: node.op,
  value: node.value
});

/** Apply a `FilterRow` update (whose `fieldId` may carry an `in:`/`out:` prefix) back onto a
 *  relation leaf, mirroring the relation filter UI's own op/value reset on field change. */
export const applyRelationLeafUpdate = (
  node: PredicateNode,
  updates: Partial<FilterCondition>,
  fields: FieldDef[]
): PredicateNode => {
  if (updates.fieldId === undefined) return { ...node, ...updates };
  const endpoint = parseEndpointFieldId(updates.fieldId);
  const field = fields.find(f => f.id === updates.fieldId);
  const op: FilterCondition['op'] = !field
    ? node.op
    : field.type === 'date'
      ? 'on'
      : field.type === 'select' || field.type === 'number' || field.type === 'boolean'
        ? 'equals'
        : 'contains';
  return {
    kind: 'predicate',
    path: endpoint ? [{ kind: 'endpoint', direction: endpoint.direction }] : [],
    fieldId: endpoint ? endpoint.fieldId : updates.fieldId,
    op,
    value: ''
  };
};

/** Seed for a relation-rooted "Add condition" - the first field in the relation field list
 *  (the `Type` select), or a bare `_schemaId` predicate as a fallback. */
export const emptyRelationPredicate = (fields: FieldDef[]): PredicateNode => {
  const field = fields[0];
  return {
    kind: 'predicate',
    path: [],
    fieldId: field?.id ?? '_schemaId',
    op: field?.type === 'text' ? 'contains' : 'equals',
    value: ''
  };
};
