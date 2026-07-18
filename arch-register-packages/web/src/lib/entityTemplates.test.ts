import { describe, expect, it } from 'vitest';
import type { EntitySchema, EntityTemplate } from '@arch-register/api-types/schemaContract';
import {
  applyEntityTemplate,
  createEntityFormDefaults,
  toEntityTemplateValues
} from './entityTemplates';

const schema: EntitySchema = {
  id: 'service',
  workspace: 'workspace',
  name: 'Service',
  description: '',
  key_prefix: 'SVC',
  fields: [
    { id: 'enabled', name: 'Enabled', type: 'boolean' },
    { id: 'score', name: 'Score', type: 'number', min: 0, max: 10 },
    {
      id: 'risk',
      name: 'Risk',
      type: 'select',
      enumId: 'risk-enum',
      options: [{ value: 'high', label: 'High' }]
    },
    {
      id: 'parent',
      name: 'Parent',
      type: 'containment',
      schemaId: 'system',
      minCount: 0,
      maxCount: 1
    }
  ],
  templates: [],
  color: null,
  icon: null,
  entity_count: 0,
  version: 1,
  created_at: '',
  updated_at: ''
};

const template: EntityTemplate = {
  id: 'vendor',
  name: 'Vendor',
  values: {
    description: 'Third party',
    owner: 'team-vendor',
    lifecycle: 'proposed',
    tags: ['vendor'],
    fields: { enabled: false, score: 5, risk: 'high', parent: ['system-1'] }
  }
};

describe('entity template form helpers', () => {
  it('applies canonical values over a fresh baseline', () => {
    const result = applyEntityTemplate({
      baseline: createEntityFormDefaults('fallback-team'),
      schema,
      template,
      allowedOwnerIds: new Set(['team-vendor']),
      lifecycleIds: new Set(['proposed']),
      referenceOptions: { system: new Set(['system-1']) }
    });
    expect(result.meta).toEqual({
      description: 'Third party',
      owner: 'team-vendor',
      lifecycle: 'proposed',
      namespace: 'default',
      tags: 'vendor'
    });
    expect(result.fields).toEqual({
      enabled: 'false',
      score: '5',
      risk: 'high',
      parent: ['system-1']
    });
    expect(result.warnings).toEqual([]);
  });

  it('keeps baseline metadata and warns when stored values are unavailable', () => {
    const result = applyEntityTemplate({
      baseline: createEntityFormDefaults('fallback-team'),
      schema,
      template: {
        ...template,
        values: { ...template.values, fields: { risk: 'removed', parent: ['removed'] } }
      },
      allowedOwnerIds: new Set(),
      lifecycleIds: new Set(),
      referenceOptions: { system: new Set() }
    });
    expect(result.meta.owner).toBe('fallback-team');
    expect(result.meta.lifecycle).toBe('');
    expect(result.fields).toEqual({});
    expect(result.warnings).toHaveLength(4);
  });

  it('serializes false, integers, arrays, and non-empty metadata', () => {
    expect(
      toEntityTemplateValues(
        schema,
        {
          enabled: 'false',
          score: '7',
          risk: 'high',
          parent: ['system-1']
        },
        {
          description: ' Default ',
          owner: 'team-vendor',
          lifecycle: 'proposed',
          namespace: 'custom',
          tags: 'vendor, risk'
        }
      )
    ).toEqual({
      description: 'Default',
      owner: 'team-vendor',
      lifecycle: 'proposed',
      namespace: 'custom',
      tags: ['vendor', 'risk'],
      fields: { enabled: false, score: 7, risk: 'high', parent: ['system-1'] }
    });
  });
});
