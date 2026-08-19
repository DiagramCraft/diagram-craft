import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { buildProposedState } from './entityProposedStateBuilder';

const schema = {
  id: 'system',
  fields: [
    { id: 'owner', name: 'Owner', type: 'text', requirementLevel: 'optional' },
    {
      id: 'contracts',
      name: 'Contracts',
      type: 'typedRelation',
      requirementLevel: 'optional',
      relationSchemaId: 'system-contract',
      direction: 'in',
      minCount: 0,
      maxCount: -1
    },
    {
      id: 'budget',
      name: 'Budget',
      type: 'derived',
      requirementLevel: 'optional',
      expression: '1',
      resultType: 'number'
    }
  ]
} as unknown as EntitySchema;

const entity = {
  _schema: { id: 'system' },
  _name: 'Customer Portal',
  _slug: 'customer-portal',
  _description: 'Customer-facing system',
  _owner: null,
  _lifecycle: null,
  _targetLifecycle: null,
  _targetLifecycleDate: null,
  _namespace: 'default',
  _tags: [],
  _links: [],
  owner: 'Platform'
} as never;

describe('buildProposedState', () => {
  it('does not serialize derived or typed-relation fields as editable data', () => {
    const proposedState = buildProposedState(entity, schema, {
      _name: 'Customer Portal',
      _description: 'Updated description',
      owner: 'Platform',
      budget: '',
      contracts: ''
    });

    expect(proposedState.data).toEqual({ owner: 'Platform' });
    expect(proposedState.data).not.toHaveProperty('budget');
    expect(proposedState.data).not.toHaveProperty('contracts');
  });
});
