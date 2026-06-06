import { describe, expect, it } from 'vitest';
import { instantiateTemplate } from './schemaTemplates.js';

describe('instantiateTemplate', () => {
  it('preserves date fields in enriched templates', () => {
    const schemas = instantiateTemplate('ws-1', 'security');
    const threat = schemas.find(schema => schema.name === 'Threat');
    const control = schemas.find(schema => schema.name === 'Control');
    const risk = schemas.find(schema => schema.name === 'Risk');

    expect(threat?.fields).toContainEqual({
      id: 'discovered_on',
      name: 'Discovered On',
      type: 'date',
    });
    expect(control?.fields).toContainEqual({
      id: 'last_verified',
      name: 'Last Verified',
      type: 'date',
    });
    expect(risk?.fields).toContainEqual({
      id: 'review_due',
      name: 'Review Due',
      type: 'date',
    });
  });

  it('keeps reference field resolution working alongside date fields', () => {
    const schemas = instantiateTemplate('ws-1', 'data-mesh');
    const dataProduct = schemas.find(schema => schema.name === 'Data Product');
    const sourceSystem = schemas.find(schema => schema.name === 'Source System');

    expect(dataProduct?.fields).toContainEqual({
      id: 'review_date',
      name: 'Review Date',
      type: 'date',
    });

    const sourceSystemsField = dataProduct?.fields.find(field => field.id === 'source_systems');
    expect(sourceSystemsField).toMatchObject({
      id: 'source_systems',
      type: 'reference',
      schemaId: sourceSystem?.id,
    });
  });
});
