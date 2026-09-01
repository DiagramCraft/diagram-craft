import { describe, expect, it } from 'vitest';
import type { QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { FieldDef } from '../../../../components/FilterBuilder';
import {
  applyRelationLeafUpdate,
  emptyRelationPredicate,
  isFlatRelationLeaf,
  relationLeafCondition,
  relationLeafFieldId
} from './relationLeaf';

const ownField = {
  kind: 'predicate' as const,
  path: [],
  fieldId: 'classification',
  op: 'equals' as const,
  value: 'restricted'
};

const endpointField: QueryNode = {
  kind: 'predicate',
  path: [{ kind: 'endpoint', direction: 'out' }],
  fieldId: 'tier',
  op: 'equals',
  value: '1'
};

const deepTraversal: QueryNode = {
  kind: 'predicate',
  path: [
    { kind: 'endpoint', direction: 'out' },
    { kind: 'forward', fieldId: 'domain' }
  ],
  fieldId: '_name',
  op: 'equals',
  value: 'Platform'
};

const fields: FieldDef[] = [
  { id: '_schemaId', name: 'Type', type: 'select', options: [] },
  { id: 'classification', name: 'Classification', type: 'select', options: [] },
  { id: 'out:tier', name: 'Out: Tier', type: 'text' }
];

describe('isFlatRelationLeaf', () => {
  it('accepts own-field and single-endpoint predicates, rejects deeper traversal', () => {
    expect(isFlatRelationLeaf(ownField)).toBe(true);
    expect(isFlatRelationLeaf(endpointField)).toBe(true);
    expect(isFlatRelationLeaf(deepTraversal)).toBe(false);
    expect(isFlatRelationLeaf({ kind: 'relationExists', path: [] })).toBe(false);
  });
});

describe('relationLeafFieldId / relationLeafCondition', () => {
  it('prefixes a single endpoint hop into the field id', () => {
    expect(relationLeafFieldId(ownField)).toBe('classification');
    expect(relationLeafFieldId(endpointField)).toBe('out:tier');
    expect(relationLeafCondition(endpointField)).toEqual({
      fieldId: 'out:tier',
      op: 'equals',
      value: '1'
    });
  });
});

describe('applyRelationLeafUpdate', () => {
  it('passes through op/value updates', () => {
    expect(applyRelationLeafUpdate(ownField, { value: 'internal' }, fields)).toEqual({
      ...ownField,
      value: 'internal'
    });
  });

  it('turns a prefixed field id into an endpoint hop and resets op/value', () => {
    expect(applyRelationLeafUpdate(ownField, { fieldId: 'out:tier' }, fields)).toEqual({
      kind: 'predicate',
      path: [{ kind: 'endpoint', direction: 'out' }],
      fieldId: 'tier',
      op: 'contains',
      value: ''
    });
  });

  it('drops the endpoint hop when switching back to an own field', () => {
    expect(applyRelationLeafUpdate(endpointField, { fieldId: 'classification' }, fields)).toEqual({
      kind: 'predicate',
      path: [],
      fieldId: 'classification',
      op: 'equals',
      value: ''
    });
  });
});

describe('emptyRelationPredicate', () => {
  it('seeds the first field (the Type select)', () => {
    expect(emptyRelationPredicate(fields)).toEqual({
      kind: 'predicate',
      path: [],
      fieldId: '_schemaId',
      op: 'equals',
      value: ''
    });
  });
});
