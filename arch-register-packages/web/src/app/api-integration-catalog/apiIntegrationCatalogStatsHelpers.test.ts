import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { classifyDataFlowRelations, selectAtRiskIntegrations } from './apiIntegrationCatalogStatsHelpers';

const relation = (
  id: string,
  overrides: { cross_boundary?: string; data_classification?: string } = {}
): RelationRecord =>
  ({
    _uid: id,
    _in: { id: `in-${id}`, name: `In ${id}` },
    _out: { id: `out-${id}`, name: `Out ${id}` },
    cross_boundary: overrides.cross_boundary ?? 'same-region',
    data_classification: overrides.data_classification ?? 'public'
  }) as unknown as RelationRecord;

describe('classifyDataFlowRelations', () => {
  it('returns empty sets for no relations', () => {
    expect(classifyDataFlowRelations([])).toEqual({
      crossing: [],
      restricted: [],
      highlySensitiveCount: 0
    });
  });

  it('classifies crossing-boundary relations', () => {
    const crossing = relation('r1', { cross_boundary: 'cross-boundary' });
    const notCrossing = relation('r2');
    const result = classifyDataFlowRelations([crossing, notCrossing]);
    expect(result.crossing).toEqual([crossing]);
    expect(result.restricted).toEqual([]);
  });

  it('classifies sensitive and highly-sensitive relations as restricted', () => {
    const sensitive = relation('r1', { data_classification: 'sensitive' });
    const highlySensitive = relation('r2', { data_classification: 'highly-sensitive' });
    const publicRelation = relation('r3', { data_classification: 'public' });
    const result = classifyDataFlowRelations([sensitive, highlySensitive, publicRelation]);
    expect(result.restricted).toEqual([sensitive, highlySensitive]);
    expect(result.highlySensitiveCount).toBe(1);
  });

  it('excludes classifications outside the restricted set', () => {
    const nonSensitive = relation('r1', { data_classification: 'non-sensitive' });
    expect(classifyDataFlowRelations([nonSensitive]).restricted).toEqual([]);
  });

  it('classifies a relation matching both predicates into both sets', () => {
    const both = relation('r1', { cross_boundary: 'cross-boundary', data_classification: 'sensitive' });
    const result = classifyDataFlowRelations([both]);
    expect(result.crossing).toEqual([both]);
    expect(result.restricted).toEqual([both]);
  });
});

describe('selectAtRiskIntegrations', () => {
  it('returns an empty array for no relations', () => {
    expect(selectAtRiskIntegrations([], 8)).toEqual([]);
  });

  it('excludes a relation matching neither predicate', () => {
    expect(selectAtRiskIntegrations([relation('r1')], 8)).toEqual([]);
  });

  it('dedupes a relation matching both predicates into a single annotated row', () => {
    const both = relation('r1', { cross_boundary: 'cross-boundary', data_classification: 'sensitive' });
    const result = selectAtRiskIntegrations([both], 8);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ relation: both, crossesBoundary: true, restricted: true });
  });

  it('annotates single-predicate relations correctly', () => {
    const crossingOnly = relation('r1', { cross_boundary: 'cross-boundary' });
    const restrictedOnly = relation('r2', { data_classification: 'sensitive' });
    const result = selectAtRiskIntegrations([crossingOnly, restrictedOnly], 8);
    expect(result).toEqual([
      { relation: crossingOnly, crossesBoundary: true, restricted: false },
      { relation: restrictedOnly, crossesBoundary: false, restricted: true }
    ]);
  });

  it('truncates to limit while preserving relative order', () => {
    const relations = [
      relation('r1', { cross_boundary: 'cross-boundary' }),
      relation('r2', { cross_boundary: 'cross-boundary' }),
      relation('r3', { cross_boundary: 'cross-boundary' })
    ];
    const result = selectAtRiskIntegrations(relations, 2);
    expect(result.map(item => item.relation._uid)).toEqual(['r1', 'r2']);
  });

  it('returns an empty array when limit is 0', () => {
    const crossing = relation('r1', { cross_boundary: 'cross-boundary' });
    expect(selectAtRiskIntegrations([crossing], 0)).toEqual([]);
  });
});
