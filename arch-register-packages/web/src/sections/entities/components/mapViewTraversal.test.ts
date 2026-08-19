import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { PathChain } from './pathBuilder/pathBuilderState';
import {
  buildMapChainQuery,
  buildTreeFromChains,
  collectMapChainNodeIds,
  decodeMapChainsByRoot,
  MAP_CHAIN_PROJECTION_ALIAS
} from './mapViewTraversal';

const entity = (id: string, name: string) =>
  ({ _uid: id, _name: name, _slug: id, _schema: { id: 'system', name: 'System' } }) as EntityRecord;

describe('mapViewTraversal chain building (#3040-map)', () => {
  it('adds a single chain projection for a non-empty hop chain, and none for an empty one', () => {
    const withHops = buildMapChainQuery(null, [{ kind: 'forward', fieldId: 'f' }]);
    expect(withHops.query.projections).toEqual([
      { path: [{ kind: 'forward', fieldId: 'f' }], fieldId: '_id', alias: MAP_CHAIN_PROJECTION_ALIAS, chain: true }
    ]);

    const noHops = buildMapChainQuery(null, []);
    expect(noHops.query.projections ?? []).toEqual([]);
  });

  it('does not duplicate the projection if one with the same alias already exists', () => {
    const base = buildMapChainQuery(null, [{ kind: 'forward', fieldId: 'f' }]).query;
    const again = buildMapChainQuery(base, [{ kind: 'forward', fieldId: 'g' }]);
    expect(again.query.projections).toHaveLength(1);
  });

  it('decodes per-root chains and collects every referenced node id', () => {
    const roots = [
      {
        _uid: 'domain-1',
        _projections: {
          [MAP_CHAIN_PROJECTION_ALIAS]: [
            [{ id: 'sys-a', name: 'A', schemaId: 'system' }],
            [{ id: 'sys-b', name: 'B', schemaId: 'system' }]
          ]
        }
      },
      { _uid: 'domain-2', _projections: {} }
    ];
    const chainsByRoot = decodeMapChainsByRoot(roots);
    expect(chainsByRoot.get('domain-1')).toHaveLength(2);
    expect(chainsByRoot.get('domain-2')).toEqual([]);
    expect(collectMapChainNodeIds(chainsByRoot).sort()).toEqual(['sys-a', 'sys-b']);
  });

  it('merges chains sharing a prefix into one tree instead of duplicating the shared node', () => {
    const domain = entity('domain-1', 'Domain One');
    const sysA = entity('sys-a', 'API Gateway');
    const compA = entity('comp-a', 'Gateway Router');
    const compB = entity('comp-b', 'Auth Middleware');
    const byId = new Map([
      ['sys-a', sysA],
      ['comp-a', compA],
      ['comp-b', compB]
    ]);

    const chains: PathChain[] = [
      [
        { id: 'sys-a', name: 'API Gateway', schemaId: 'system' },
        { id: 'comp-a', name: 'Gateway Router', schemaId: 'component' }
      ],
      [
        { id: 'sys-a', name: 'API Gateway', schemaId: 'system' },
        { id: 'comp-b', name: 'Auth Middleware', schemaId: 'component' }
      ]
    ];

    const tree = buildTreeFromChains(
      [domain],
      new Map([['domain-1', chains]]),
      id => byId.get(id)
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]!.node._uid).toBe('domain-1');
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.node._uid).toBe('sys-a');
    expect(tree[0]!.children[0]!.levelIndex).toBe(1);
    // Sorted by name: "Auth Middleware" before "Gateway Router".
    expect(tree[0]!.children[0]!.children.map(c => c.node._uid)).toEqual(['comp-b', 'comp-a']);
    expect(tree[0]!.children[0]!.children.map(c => c.levelIndex)).toEqual([2, 2]);
  });

  it('drops a chain node and its descendants when it fails to hydrate', () => {
    const domain = entity('domain-1', 'Domain One');
    const chains: PathChain[] = [
      [
        { id: 'sys-missing', name: 'Missing System', schemaId: 'system' },
        { id: 'comp-a', name: 'Should not appear', schemaId: 'component' }
      ]
    ];

    const tree = buildTreeFromChains([domain], new Map([['domain-1', chains]]), () => undefined);

    expect(tree[0]!.children).toEqual([]);
  });

  it('sorts roots by name too', () => {
    const b = entity('b', 'Bravo');
    const a = entity('a', 'Alpha');
    const tree = buildTreeFromChains([b, a], new Map(), () => undefined);
    expect(tree.map(t => t.node._uid)).toEqual(['a', 'b']);
  });
});
