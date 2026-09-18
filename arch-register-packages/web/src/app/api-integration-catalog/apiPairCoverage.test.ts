import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { computeApiPairCoverage, computeApiPairs } from './apiPairCoverage';

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

describe('computeApiPairs', () => {
  it('pairs a single provider with a single consumer of the same API', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];

    const pairs = computeApiPairs(providers, consumers, []);

    expect(pairs).toEqual([
      {
        key: 'sys-b:api-1:sys-a',
        consumer: system('sys-b', 'System B'),
        provider: system('sys-a', 'System A'),
        api: api('api-1', 'Orders API'),
        consumerRelationId: 'c1',
        providerRelationId: 'p1',
        hasDataFlow: false,
        dataFlowApplicable: true
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

    const pairs = computeApiPairs(providers, consumers, []);

    expect(pairs).toHaveLength(4);
  });

  it('flags hasDataFlow true when a Data Flow relation exists between the pair, either direction', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];
    const dataFlows = [relation('df1', system('sys-b', 'System B'), system('sys-a', 'System A'))];

    const pairs = computeApiPairs(providers, consumers, dataFlows);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.hasDataFlow).toBe(true);
    expect(pair.dataFlowApplicable).toBe(true);
  });

  it('flags hasDataFlow false when no matching Data Flow relation exists (the gap case)', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];
    const dataFlows = [relation('df1', system('sys-b', 'System B'), system('sys-x', 'System X'))];

    const pairs = computeApiPairs(providers, consumers, dataFlows);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.hasDataFlow).toBe(false);
    expect(pair.dataFlowApplicable).toBe(true);
  });

  it('marks a pair not applicable when an endpoint is Component-typed', () => {
    const providers = [
      relation('p1', component('cmp-a', 'Component A'), api('api-1', 'Orders API'))
    ];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];
    const dataFlows = [relation('df1', system('sys-b', 'System B'), system('sys-x', 'System X'))];

    const pairs = computeApiPairs(providers, consumers, dataFlows);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.dataFlowApplicable).toBe(false);
  });

  it('treats every pair as applicable when the workspace has no Data Flow relations yet', () => {
    const providers = [
      relation('p1', component('cmp-a', 'Component A'), api('api-1', 'Orders API'))
    ];
    const consumers = [relation('c1', system('sys-b', 'System B'), api('api-1', 'Orders API'))];

    const pairs = computeApiPairs(providers, consumers, []);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;

    expect(pair.dataFlowApplicable).toBe(true);
    expect(pair.hasDataFlow).toBe(false);
  });

  it('excludes an entity that both provides and consumes the same API from pairing with itself', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];
    const consumers = [relation('c1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];

    const pairs = computeApiPairs(providers, consumers, []);

    expect(pairs).toHaveLength(0);
  });

  it('produces no pairs for an API with only providers or only consumers', () => {
    const providers = [relation('p1', system('sys-a', 'System A'), api('api-1', 'Orders API'))];

    expect(computeApiPairs(providers, [], [])).toHaveLength(0);
  });
});

describe('computeApiPairCoverage', () => {
  it('reconciles totals across covered, gap, and not-applicable pairs', () => {
    const pairs = [
      { dataFlowApplicable: true, hasDataFlow: true },
      { dataFlowApplicable: true, hasDataFlow: false },
      { dataFlowApplicable: true, hasDataFlow: false },
      { dataFlowApplicable: false, hasDataFlow: false }
    ] as ReturnType<typeof computeApiPairs>;

    expect(computeApiPairCoverage(pairs)).toEqual({
      totalPairs: 4,
      applicablePairs: 3,
      coveredPairs: 1,
      gapPairs: 2,
      notApplicablePairs: 1
    });
  });

  it('returns all-zero summary for an empty pair list', () => {
    expect(computeApiPairCoverage([])).toEqual({
      totalPairs: 0,
      applicablePairs: 0,
      coveredPairs: 0,
      gapPairs: 0,
      notApplicablePairs: 0
    });
  });
});
