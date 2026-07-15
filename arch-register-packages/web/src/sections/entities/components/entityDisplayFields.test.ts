import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { BrowserEntityRecord } from './entityBrowserState';
import {
  buildEntityDisplayFields,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  withDisplayFieldIds,
  withoutDisplayFieldIds
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
    expect(withoutDisplayFieldIds({ leftDepth: 2, fieldIds: ['active'] })).toEqual({
      leftDepth: 2
    });
    expect(withoutDisplayFieldIds({ fieldIds: ['active'] })).toBeNull();
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

describe('joined assessment display fields', () => {
  const assessment: Assessment = {
    id: 'assessment-1',
    workspace: 'ws-1',
    project_id: 'proj-1',
    name: 'Security review',
    description: '',
    status: 'open',
    scope: ['service'],
    scope_conditions: [],
    fields: [
      { id: 'rating1', label: 'Rating', requirementLevel: 'required', type: 'rating' },
      {
        id: 'enum1',
        label: 'Risk',
        requirementLevel: 'optional',
        type: 'enum',
        enumId: 'risk-enum'
      }
    ],
    response_count: 0,
    completed_entity_count: 0,
    created_at: '',
    updated_at: ''
  };

  const enums: WorkspaceEnum[] = [
    {
      id: 'risk-enum',
      workspace: 'ws-1',
      name: 'Risk',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' }
      ],
      sort_order: 0,
      created_at: '',
      updated_at: ''
    }
  ];

  it('appends joined assessment fields under a dedicated group', () => {
    const fields = buildEntityDisplayFields([schema], false, { assessment, enums });
    const ratingField = fields.find(f => f.id === '_assessment:rating1');
    const enumField = fields.find(f => f.id === '_assessment:enum1');
    expect(ratingField).toMatchObject({ label: 'Rating', group: 'Assessment: Security review' });
    expect(enumField?.assessmentField?.options).toEqual(enums[0]!.options);
  });

  it('formats missing responses as blank and resolves enum labels', () => {
    const fields = buildEntityDisplayFields([schema], false, { assessment, enums });
    const ratingField = fields.find(f => f.id === '_assessment:rating1')!;
    const enumField = fields.find(f => f.id === '_assessment:enum1')!;

    const withoutResponse = { _assessment: null } as unknown as EntityRecord;
    expect(formatEntityDisplayValue(withoutResponse, ratingField)).toBeNull();

    const withResponse = {
      _assessment: { rating1: 4, enum1: 'high' }
    } as unknown as BrowserEntityRecord as EntityRecord;
    expect(formatEntityDisplayValue(withResponse, ratingField)).toBe('4');
    expect(formatEntityDisplayValue(withResponse, enumField)).toBe('High');
  });
});
