import { describe, expect, it } from 'vitest';
import type { EntityQuery, QueryNode } from '@arch-register/api-types/entityQueryIR';
import {
  addChild,
  countHops,
  emptyGroup,
  emptyPredicate,
  exceedsHopBudget,
  fromEditableRoot,
  getNode,
  isVisuallyEditable,
  removeNode,
  setGroupKind,
  toEditableRoot,
  toggleNot,
  updateNode,
  wrapInGroup
} from './queryBuilderState';

const predicate = (fieldId: string): QueryNode => ({
  kind: 'predicate',
  path: [],
  fieldId,
  op: 'equals',
  value: fieldId
});

const query = (root: QueryNode): EntityQuery => ({ root });

describe('toEditableRoot / fromEditableRoot', () => {
  it('wraps a bare predicate root in an and-group', () => {
    const editable = toEditableRoot(query(predicate('_name')));
    expect(editable.root).toEqual({ kind: 'and', children: [predicate('_name')] });
  });

  it('leaves a group root untouched', () => {
    const grouped = query({ kind: 'and', children: [predicate('a'), predicate('b')] });
    expect(toEditableRoot(grouped)).toBe(grouped);
  });

  it('fromEditableRoot is an identity pass-through (root stays a group)', () => {
    const single = query({ kind: 'and', children: [predicate('a')] });
    expect(fromEditableRoot(single)).toBe(single);
    const nested = query({ kind: 'and', children: [{ kind: 'or', children: [predicate('a')] }] });
    expect(fromEditableRoot(nested)).toBe(nested);
  });
});

describe('tree edits', () => {
  it('addChild appends to the addressed group', () => {
    const root = emptyGroup('and');
    const next = addChild(root, [], predicate('a'));
    expect(next).toEqual({ kind: 'and', children: [predicate('a')] });
  });

  it('updateNode replaces a nested node without touching siblings', () => {
    const root: QueryNode = {
      kind: 'and',
      children: [predicate('a'), { kind: 'or', children: [predicate('b'), predicate('c')] }]
    };
    const next = updateNode(root, [1, 0], () => predicate('B'));
    expect(getNode(next, [1, 0])).toEqual(predicate('B'));
    expect(getNode(next, [0])).toEqual(predicate('a'));
    expect(getNode(next, [1, 1])).toEqual(predicate('c'));
  });

  it('removeNode drops the addressed child', () => {
    const root: QueryNode = { kind: 'and', children: [predicate('a'), predicate('b')] };
    expect(removeNode(root, [0])).toEqual({ kind: 'and', children: [predicate('b')] });
  });

  it('setGroupKind flips and <-> or in place', () => {
    const root: QueryNode = { kind: 'and', children: [predicate('a')] };
    expect(setGroupKind(root, [], 'or')).toEqual({ kind: 'or', children: [predicate('a')] });
  });

  it('toggleNot wraps then unwraps at the same path', () => {
    const root: QueryNode = { kind: 'and', children: [predicate('a')] };
    const wrapped = toggleNot(root, [0]);
    expect(getNode(wrapped, [0])).toEqual({ kind: 'not', child: predicate('a') });
    expect(getNode(wrapped, [0, 0])).toEqual(predicate('a'));
    expect(toggleNot(wrapped, [0])).toEqual(root);
  });

  it('removeNode through a not collapses the not away', () => {
    const root: QueryNode = {
      kind: 'and',
      children: [{ kind: 'not', child: predicate('a') }, predicate('b')]
    };
    expect(removeNode(root, [0, 0])).toEqual({ kind: 'and', children: [predicate('b')] });
  });

  it('wrapInGroup nests the row as the new group first child', () => {
    const root: QueryNode = { kind: 'and', children: [predicate('a'), predicate('b')] };
    const next = wrapInGroup(root, [1], 'or');
    expect(getNode(next, [1])).toEqual({ kind: 'or', children: [predicate('b')] });
  });
});

describe('removeNode leaves siblings and ancestors intact', () => {
  it('removing an inner group keeps the outer group even when it was the only child', () => {
    const root: QueryNode = {
      kind: 'and',
      children: [{ kind: 'or', children: [{ kind: 'or', children: [predicate('b')] }] }]
    };
    // slot path to the inner group: root.children[0].children[0]
    expect(removeNode(root, [0, 0])).toEqual({
      kind: 'and',
      children: [{ kind: 'or', children: [] }]
    });
  });
});

describe('countHops / MAX_PATH_HOPS budget', () => {
  it('counts the longest predicate path', () => {
    const q = query({
      kind: 'and',
      children: [
        {
          kind: 'predicate',
          path: [{ kind: 'forward', fieldId: 'system' }],
          fieldId: '_name',
          op: 'equals',
          value: 'x'
        },
        {
          kind: 'predicate',
          path: [
            { kind: 'forward', fieldId: 'technology_releases' },
            { kind: 'forward', fieldId: 'technology' }
          ],
          fieldId: '_slug',
          op: 'equals',
          value: 'go'
        }
      ]
    });
    expect(countHops(q)).toBe(2);
  });

  it('adds hops nested inside a scoped PathStep.filter cumulatively', () => {
    const q = query({
      kind: 'and',
      children: [
        {
          kind: 'relationExists',
          path: [
            {
              kind: 'forward',
              fieldId: 'technology_releases',
              filter: {
                kind: 'predicate',
                path: [{ kind: 'forward', fieldId: 'technology' }],
                fieldId: '_slug',
                op: 'equals',
                value: 'go'
              }
            }
          ]
        }
      ]
    });
    expect(countHops(q)).toBe(2);
  });

  it('flags a query that exceeds the 6-hop budget', () => {
    const deep = Array.from({ length: 7 }, () => ({ kind: 'forward' as const, fieldId: 'x' }));
    const q = query({
      kind: 'and',
      children: [{ kind: 'predicate', path: deep, fieldId: '_name', op: 'equals', value: 'x' }]
    });
    expect(countHops(q)).toBe(7);
    expect(exceedsHopBudget(q)).toBe(true);
  });

  it('counts projection paths too', () => {
    const q: EntityQuery = {
      root: emptyGroup('and'),
      projections: [
        {
          path: [
            { kind: 'forward', fieldId: 'technology_releases' },
            { kind: 'forward', fieldId: 'technology' }
          ],
          fieldId: '_name'
        }
      ]
    };
    expect(countHops(q)).toBe(2);
  });
});

describe('isVisuallyEditable', () => {
  it('accepts a flat boolean tree of predicates and free text', () => {
    expect(
      isVisuallyEditable(
        query({
          kind: 'and',
          children: [predicate('a'), { kind: 'not', child: predicate('b') }, { kind: 'freeText', value: 'x' }]
        })
      )
    ).toBe(true);
  });

  it('accepts entity-to-entity relation traversal and relationExists', () => {
    expect(
      isVisuallyEditable(
        query({
          kind: 'and',
          children: [
            {
              kind: 'predicate',
              path: [
                { kind: 'forward', fieldId: 'system' },
                { kind: 'typedRelation', fieldId: 'depends_on', relationSchemaId: 'r', direction: 'out', ownerSchemaIds: ['system'] }
              ],
              fieldId: '_name',
              op: 'equals',
              value: 'x'
            },
            { kind: 'relationExists', path: [{ kind: 'backward', fieldId: 'component', ownerSchemaId: 'component' }] }
          ]
        })
      )
    ).toBe(true);
  });

  it('accepts a scoped [...] filter whose own subtree is editable', () => {
    expect(
      isVisuallyEditable(
        query({
          kind: 'and',
          children: [
            {
              kind: 'relationExists',
              path: [
                {
                  kind: 'forward',
                  fieldId: 'technology_releases',
                  filter: { kind: 'predicate', path: [], fieldId: '_slug', op: 'equals', value: 'go' }
                }
              ]
            }
          ]
        })
      )
    ).toBe(true);
  });

  it('rejects a scoped [...] filter that itself uses a relation-context step', () => {
    expect(
      isVisuallyEditable(
        query({
          kind: 'and',
          children: [
            {
              kind: 'relationExists',
              path: [
                {
                  kind: 'forward',
                  fieldId: 'technology_releases',
                  filter: {
                    kind: 'relationExists',
                    path: [{ kind: 'endpoint', direction: 'out' }]
                  }
                }
              ]
            }
          ]
        })
      )
    ).toBe(false);
  });

  it('accepts a relation-rooted tree of own-field and single-endpoint predicates', () => {
    expect(
      isVisuallyEditable({
        root_kind: 'relation',
        root: {
          kind: 'or',
          children: [
            { kind: 'predicate', path: [], fieldId: 'classification', op: 'equals', value: 'x' },
            {
              kind: 'predicate',
              path: [{ kind: 'endpoint', direction: 'out' }],
              fieldId: 'tier',
              op: 'equals',
              value: '1'
            }
          ]
        }
      })
    ).toBe(true);
  });

  it('rejects a relation-rooted query with deeper endpoint traversal', () => {
    expect(
      isVisuallyEditable({
        root_kind: 'relation',
        root: {
          kind: 'and',
          children: [
            {
              kind: 'predicate',
              path: [
                { kind: 'endpoint', direction: 'out' },
                { kind: 'forward', fieldId: 'domain' }
              ],
              fieldId: '_name',
              op: 'equals',
              value: 'x'
            }
          ]
        }
      })
    ).toBe(false);
  });

  it('rejects relation-context step kinds and projections', () => {
    expect(
      isVisuallyEditable(
        query({
          kind: 'and',
          children: [{ kind: 'relationExists', path: [{ kind: 'endpoint', direction: 'out' }] }]
        })
      )
    ).toBe(false);
    expect(
      isVisuallyEditable({
        root: emptyGroup('and'),
        projections: [{ path: [{ kind: 'forward', fieldId: 'system' }], fieldId: '_name' }]
      })
    ).toBe(false);
  });
});

describe('emptyPredicate', () => {
  it('matches FilterBuilder addCondition seed', () => {
    expect(emptyPredicate()).toEqual({
      kind: 'predicate',
      path: [],
      fieldId: '_name',
      op: 'contains',
      value: ''
    });
  });
});
