import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  computeRelationPairCoverage,
  computeRelationPairs,
  resolveTypedRelationSchemaId
} from './relationPairCoverageLogic';

const relation = (
  uid: string,
  inRef: { id: string; name: string; schemaId?: string },
  outRef: { id: string; name: string; schemaId?: string }
): RelationRecord =>
  ({
    _uid: uid,
    _in: inRef,
    _out: outRef
  }) as unknown as RelationRecord;

const system = (id: string, name: string) => ({ id, name, schemaId: 'system' });
const component = (id: string, name: string) => ({ id, name, schemaId: 'component' });
const api = (id: string, name: string) => ({ id, name, schemaId: 'api' });

describe('computeRelationPairs', () => {
  it('pairs a single provider with a single consumer of the same API', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];

    const pairs = computeRelationPairs(providers, consumers, []);

    expect(pairs).toEqual([
      {
        key: 'sys-b:api-1:sys-a',
        consumer: system('sys-b', 'System B'),
        provider: system('sys-a', 'System A'),
        hub: api('api-1', 'Orders API'),
        consumerRelationId: 'c1',
        providerRelationId: 'p1',
        hasCoverage: false,
        coverageApplicable: true
      }
    ]);
  });

  it('cross-joins multiple providers with multiple consumers of the same API', () => {
    const providers = [
      relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API')),
      relation('p2', system('sys-c', 'System C'), api('api-1', 'Orders API'))
    ];
    const consumers = [
      relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API')),
      relation('c2', system('sys-d', 'System D'), api('api-1', 'Orders API'))
    ];

    const pairs = computeRelationPairs(providers, consumers, []);

    expect(pairs).toHaveLength(4);
  });

  it('flags hasCoverage true when a Data Flow relation exists between the pair, either direction', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];
    const dataFlows = [relation('df1', system('sys-b', 'System B'), system('sys-a', 'System A'))];

    const pairs = computeRelationPairs(providers, consumers, dataFlows);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.hasCoverage).toBe(true);
    expect(pair.coverageApplicable).toBe(true);
  });

  it('flags hasCoverage false when no matching Data Flow relation exists (the gap case)', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];
    const dataFlows = [relation('df1', system('sys-b', 'System B'), system('sys-x', 'System X'))];

    const pairs = computeRelationPairs(providers, consumers, dataFlows);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.hasCoverage).toBe(false);
    expect(pair.coverageApplicable).toBe(true);
  });

  it('marks a pair not applicable when an endpoint is Component-typed', () => {
    const providers = [
      relation('p1', component('cmp-a', 'Component A'), api('api-1', 'Orders API'))
    ];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];
    const dataFlows = [relation('df1', system('sys-b', 'System B'), system('sys-x', 'System X'))];

    const pairs = computeRelationPairs(providers, consumers, dataFlows);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.coverageApplicable).toBe(false);
  });

  it('treats every pair as applicable when the workspace has no Data Flow relations yet', () => {
    const providers = [
      relation('p1', component('cmp-a', 'Component A'), api('api-1', 'Orders API'))
    ];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];

    const pairs = computeRelationPairs(providers, consumers, []);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.coverageApplicable).toBe(true);
    expect(pair.hasCoverage).toBe(false);
  });

  it('excludes an entity that both provides and consumes the same API from pairing with itself', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];

    const pairs = computeRelationPairs(providers, consumers, []);

    expect(pairs).toHaveLength(0);
  });

  it('produces no pairs for an API with only providers or only consumers', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];

    expect(computeRelationPairs(providers, [], [])).toHaveLength(0);
  });
});

describe('computeRelationPairCoverage', () => {
  it('reconciles totals across covered, gap, and not-applicable pairs', () => {
    const pairs = [
      { coverageApplicable: true, hasCoverage: true },
      { coverageApplicable: true, hasCoverage: false },
      { coverageApplicable: true, hasCoverage: false },
      { coverageApplicable: false, hasCoverage: false }
    ] as ReturnType<typeof computeRelationPairs>;

    expect(computeRelationPairCoverage(pairs)).toEqual({
      totalPairs: 4,
      applicablePairs: 3,
      coveredPairs: 1,
      gapPairs: 2,
      notApplicablePairs: 1
    });
  });

  it('returns all-zero summary for an empty pair list', () => {
    expect(computeRelationPairCoverage([])).toEqual({
      totalPairs: 0,
      applicablePairs: 0,
      coveredPairs: 0,
      gapPairs: 0,
      notApplicablePairs: 0
    });
  });
});

describe('resolveTypedRelationSchemaId', () => {
  const hub = {
    id: 'api',
    name: 'API',
    fields: [
      {
        id: 'providers',
        name: 'Provided by',
        type: 'typedRelation',
        relationSchemaId: 'rs-provides'
      },
      { id: 'api_version', name: 'API Version', type: 'text' }
    ]
  } as unknown as EntitySchema;

  it('matches a typed relation field by id or name', () => {
    expect(resolveTypedRelationSchemaId(hub, 'providers')).toBe('rs-provides');
    expect(resolveTypedRelationSchemaId(hub, 'Provided by')).toBe('rs-provides');
  });

  it('is null for missing or non-relation fields', () => {
    expect(resolveTypedRelationSchemaId(hub, 'API Version')).toBeNull();
    expect(resolveTypedRelationSchemaId(hub, 'Nope')).toBeNull();
    expect(resolveTypedRelationSchemaId(undefined, 'providers')).toBeNull();
  });
});
