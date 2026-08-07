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

  it('keeps technology release scoped to the default catalog template', () => {
    const defaultTemplate = SCHEMA_TEMPLATES.find(template => template.id === 'default');
    expect(defaultTemplate?.schemas).toContainEqual(
      expect.objectContaining({ name: 'Technology Release' })
    );

    for (const template of SCHEMA_TEMPLATES.filter(template => template.id !== 'default')) {
      expect(template.schemas).not.toContainEqual(
        expect.objectContaining({ name: 'Technology Release' })
      );
    }
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

  it('materializes the default Contract relation with remapped endpoints and enum', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'default');
    const system = definitions.schemas.find(schema => schema.name === 'System');
    const contract = definitions.schemas.find(schema => schema.name === 'Contract');
    const vendor = definitions.schemas.find(schema => schema.name === 'Vendor');
    const relation = definitions.relationSchemas.find(schema => schema.name === 'System Contract');
    const purpose = relation?.fields.find(field => field.id === 'purpose');

    expect(vendor).toBeDefined();
    expect(vendor?.fields).toEqual([]);
    expect(contract?.fields).toContainEqual({
      id: 'vendor',
      name: 'Vendor',
      predicate: 'provided by',
      type: 'containment',
      schemaId: vendor?.id,
      minCount: 1,
      maxCount: 1,
      requirementLevel: 'required'
    });
    expect(contract?.fields).not.toContainEqual(expect.objectContaining({ id: 'vendor_name' }));
    expect(relation?.in_schema_ids).toEqual([system?.id]);
    expect(relation?.out_schema_ids).toEqual([contract?.id]);
    expect(purpose).toMatchObject({
      type: 'select',
      enumId: definitions.enums.find(e => e.name === 'Contract Purpose')?.id
    });
    expect(system?.fields).toContainEqual(
      expect.objectContaining({
        id: 'contracts',
        type: 'typedRelation',
        relationSchemaId: relation?.id,
        direction: 'out'
      })
    );
    expect(contract?.fields).toContainEqual(
      expect.objectContaining({
        id: 'system',
        type: 'typedRelation',
        relationSchemaId: relation?.id,
        direction: 'in'
      })
    );
  });

  it('seeds the reusable PII classification fieldgroup for the default catalog', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'default');
    const fieldGroup = definitions.fieldGroups.find(group => group.name === 'PII Classification');
    const enumIds = new Set(definitions.enums.map(enumeration => enumeration.id));

    expect(fieldGroup).toBeDefined();
    expect(fieldGroup?.fields).toEqual([
      expect.objectContaining({
        id: 'pii_classification',
        name: 'PII Classification',
        type: 'select',
        enumId: expect.any(String)
      }),
      { id: 'pii_scope', name: 'PII Scope', type: 'text' }
    ]);
    const classificationField = fieldGroup?.fields.find(field => field.id === 'pii_classification');
    expect(classificationField?.type === 'select' && enumIds.has(classificationField.enumId)).toBe(
      true
    );

    for (const schemaName of ['API', 'Component', 'System']) {
      const schema = definitions.schemas.find(item => item.name === schemaName);
      expect(schema?.shared_field_group_links).toEqual([{ groupId: fieldGroup?.id }]);
    }
  });
});
