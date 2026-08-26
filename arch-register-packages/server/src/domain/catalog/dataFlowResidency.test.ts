import { describe, expect, it } from 'vitest';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import {
  computeCrossBoundary,
  computeDataFlowResidencyStatus,
  computeResidencyInvalid
} from './dataFlowResidency';

const now = new Date('2026-08-25T00:00:00.000Z');

describe('computeCrossBoundary', () => {
  it('is incomplete when either region is missing', () => {
    expect(computeCrossBoundary(null, 'eu')).toBe('incomplete');
    expect(computeCrossBoundary('eu', undefined)).toBe('incomplete');
    expect(computeCrossBoundary(null, null)).toBe('incomplete');
  });

  it('is same-region when source and destination match', () => {
    expect(computeCrossBoundary('eu', 'eu')).toBe('same-region');
  });

  it('is cross-boundary when source and destination differ', () => {
    expect(computeCrossBoundary('eu', 'us')).toBe('cross-boundary');
  });
});

describe('computeResidencyInvalid', () => {
  it('is not-applicable when there are no carried entities', () => {
    expect(computeResidencyInvalid('eu', [])).toBe('not-applicable');
  });

  it('is not-applicable when no carried entity declares any permitted regions', () => {
    expect(computeResidencyInvalid('eu', [[], []])).toBe('not-applicable');
  });

  it('is incomplete when the destination region is missing but a carried entity has permitted regions', () => {
    expect(computeResidencyInvalid(null, [['eu']])).toBe('incomplete');
  });

  it('is valid when the destination region is permitted by every carried entity that restricts it', () => {
    expect(computeResidencyInvalid('eu', [['eu', 'uk'], []])).toBe('valid');
  });

  it('is invalid when the destination region is not permitted by any carried entity', () => {
    expect(computeResidencyInvalid('us', [['eu', 'uk']])).toBe('invalid');
  });

  it('is invalid when at least one of several carried entities does not permit the destination', () => {
    expect(computeResidencyInvalid('eu', [['eu'], ['us']])).toBe('invalid');
  });
});

const dataFlowSchema = {
  id: 'schema-data-flow',
  workspace: 'ws-1',
  name: 'Data Flow',
  description: '',
  in_schema_ids: ['schema-system'],
  out_schema_ids: ['schema-system'],
  color: null,
  icon: null,
  created_at: now,
  updated_at: now,
  fields: [
    {
      id: 'source_residency_region',
      name: 'Source Residency Region',
      type: 'select',
      enumId: 'residency-regions'
    },
    {
      id: 'destination_residency_region',
      name: 'Destination Residency Region',
      type: 'select',
      enumId: 'residency-regions'
    },
    {
      id: 'data_entities',
      name: 'Data',
      type: 'entityRelation',
      predicate: 'carries',
      schemaId: 'schema-data-entity',
      minCount: 0,
      maxCount: -1
    }
  ]
} as unknown as RelationSchemaDbResult;

const unrelatedSchema = {
  id: 'schema-provides-api',
  workspace: 'ws-1',
  name: 'Provides API',
  description: '',
  in_schema_ids: ['schema-component'],
  out_schema_ids: ['schema-api'],
  color: null,
  icon: null,
  created_at: now,
  updated_at: now,
  fields: []
} as unknown as RelationSchemaDbResult;

describe('computeDataFlowResidencyStatus', () => {
  it('combines cross-boundary and residency-invalid status for a Data Flow relation', () => {
    const result = computeDataFlowResidencyStatus(
      { data: { source_residency_region: 'eu', destination_residency_region: 'us' } },
      dataFlowSchema,
      [['eu', 'uk']]
    );
    expect(result.crossBoundary).toBe('cross-boundary');
    expect(result.residencyInvalid).toBe('invalid');
  });

  it('is incomplete/not-applicable for a schema without the residency fields', () => {
    const result = computeDataFlowResidencyStatus({ data: {} }, unrelatedSchema, []);
    expect(result.crossBoundary).toBe('incomplete');
    expect(result.residencyInvalid).toBe('not-applicable');
  });
});
