import { describe, expect, it } from 'vitest';
import {
  instantiateTemplate,
  instantiateTemplateDefinitions,
  SCHEMA_TEMPLATES
} from './schemaTemplates';

describe('instantiateTemplate', () => {
  it('preserves date fields in enriched templates', () => {
    const schemas = instantiateTemplate('ws-1', 'security');
    const threat = schemas.find(schema => schema.name === 'Threat');
    const control = schemas.find(schema => schema.name === 'Control');
    const risk = schemas.find(schema => schema.name === 'Risk');

    expect(threat?.fields).toContainEqual({
      id: 'discovered_on',
      name: 'Discovered On',
      type: 'date'
    });
    expect(control?.fields).toContainEqual({
      id: 'last_verified',
      name: 'Last Verified',
      type: 'date'
    });
    expect(risk?.fields).toContainEqual({
      id: 'review_due',
      name: 'Review Due',
      type: 'date'
    });
  });

  it('keeps reference field resolution working alongside date fields', () => {
    const schemas = instantiateTemplate('ws-1', 'data-mesh');
    const dataProduct = schemas.find(schema => schema.name === 'Data Product');
    const sourceSystem = schemas.find(schema => schema.name === 'Source System');

    expect(dataProduct?.fields).toContainEqual({
      id: 'review_date',
      name: 'Review Date',
      type: 'date'
    });

    const sourceSystemsField = dataProduct?.fields.find(field => field.id === 'source_systems');
    expect(sourceSystemsField).toMatchObject({
      id: 'source_systems',
      type: 'reference',
      schemaId: sourceSystem?.id
    });
  });

  it('preserves relation predicates when present in templates', () => {
    const schemas = instantiateTemplate('ws-1', 'backstage');
    const component = schemas.find(schema => schema.name === 'Component');

    expect(component?.fields.find(field => field.id === 'consumes_apis')).toMatchObject({
      id: 'consumes_apis',
      type: 'reference',
      predicate: 'consumes'
    });
  });

  it('adds technology release tracking to architecture-focused templates', () => {
    for (const templateId of ['backstage', 'c4', 'itil', 'ddd', 'archimate']) {
      const definitions = instantiateTemplateDefinitions('ws-1', templateId);
      const technologyRelease = definitions.schemas.find(
        schema => schema.name === 'Technology Release'
      );
      expect(technologyRelease).toBeDefined();
      expect(technologyRelease?.fields).toContainEqual({
        id: 'eol_date',
        name: 'EOL Date',
        type: 'date',
        external_kind: 'integration',
        refresh_mode: 'scheduled'
      });
      expect(
        definitions.schemas.some(schema =>
          schema.fields.some(
            field => field.type === 'reference' && field.schemaId === technologyRelease?.id
          )
        )
      ).toBe(true);
    }

    expect(instantiateTemplateDefinitions('ws-1', 'data-mesh').schemas).not.toContainEqual(
      expect.objectContaining({ name: 'Technology Release' })
    );
    expect(instantiateTemplateDefinitions('ws-1', 'team-topologies').schemas).not.toContainEqual(
      expect.objectContaining({ name: 'Technology Release' })
    );
  });

  it('defines an enum for every select field in every built-in template', () => {
    for (const template of SCHEMA_TEMPLATES) {
      const enumIds = new Set(template.enums.map(enumeration => enumeration.id));
      const selectFields = template.schemas.flatMap(schema =>
        schema.fields.filter(field => field.type === 'select')
      );

      expect(selectFields.every(field => enumIds.has(field.enumId))).toBe(true);
      expect(template.enums.every(enumeration => enumeration.options.length > 0)).toBe(true);
    }
  });

  it('materializes enums and document definitions with remapped references', () => {
    const definitions = instantiateTemplateDefinitions(
      'ws-1',
      'security',
      new Date('2026-01-01T00:00:00.000Z')
    );
    const enumIds = new Set(definitions.enums.map(enumeration => enumeration.id));
    const securitySelects = definitions.schemas.flatMap(schema =>
      schema.fields.filter(field => field.type === 'select')
    );

    expect(definitions.enums).toHaveLength(6);
    expect(securitySelects.every(field => enumIds.has(field.enumId))).toBe(true);
    expect(definitions.documentTypes).toEqual([
      expect.objectContaining({
        name: 'Architecture Decision Record',
        workspace: 'ws-1'
      })
    ]);
    expect(definitions.documentTemplates).toEqual([
      expect.objectContaining({
        name: 'Architecture Decision Record',
        workspace: 'ws-1',
        document_type_id: definitions.documentTypes[0]!.id,
        metadata_defaults: { status: 'Proposed' }
      })
    ]);
  });
});
