import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  buildEntityDisplayFields,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  withDisplayFieldIds
} from './entityDisplayFields';

const schema = {
  id: 'service',
  name: 'Service',
  fields: [
    { id: 'technology', name: 'Technology', type: 'text' },
    { id: 'active', name: 'Active', type: 'boolean' },
    {
      id: 'phase',
      name: 'Phase',
      type: 'select',
      enumId: 'phase',
      options: [{ value: 'prod', label: 'Production' }]
    },
    {
      id: 'parent',
      name: 'Parent',
      type: 'containment',
      schemaId: 'domain',
      minCount: 0,
      maxCount: 1
    }
  ]
} as EntitySchema;

describe('entity display fields', () => {
  it('builds scalar options, excludes relationships, and deduplicates field ids', () => {
    const duplicate = { ...schema, id: 'app', name: 'Application' };
    const fields = buildEntityDisplayFields([schema, duplicate], false);
    expect(fields.filter(field => field.id === 'technology')).toHaveLength(1);
    expect(fields.some(field => field.id === 'parent')).toBe(false);
    expect(fields.some(field => field.id === '_projectRole')).toBe(false);
  });

  it('distinguishes an explicit empty selection from legacy defaults', () => {
    expect(getDisplayFieldIds('cards', null)).toContain('_description');
    expect(getDisplayFieldIds('cards', { fieldIds: [] })).toEqual([]);
    expect(withDisplayFieldIds({ leftDepth: 2 }, ['active'])).toEqual({
      leftDepth: 2,
      fieldIds: ['active']
    });
  });

  it('formats standard, boolean, and select values', () => {
    const entity = {
      _description: 'A service',
      _owner: { id: 'u', name: 'Owner' },
      _lifecycle: null,
      _slug: 'service',
      _namespace: 'default',
      _tags: [],
      _completeness: 80,
      _projectLink: undefined,
      active: true,
      phase: 'prod'
    } as unknown as EntityRecord;
    const fields = buildEntityDisplayFields([schema], false);
    expect(formatEntityDisplayValue(entity, fields.find(field => field.id === '_owner')!)).toBe(
      'Owner'
    );
    expect(formatEntityDisplayValue(entity, fields.find(field => field.id === 'active')!)).toBe(
      'Yes'
    );
    expect(formatEntityDisplayValue(entity, fields.find(field => field.id === 'phase')!)).toBe(
      'Production'
    );
  });
});
