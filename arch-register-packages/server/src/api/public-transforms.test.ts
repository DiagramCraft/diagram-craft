import { describe, expect, it } from 'vitest';
import {
  toDiagramCraftData,
  toDiagramCraftField,
  toDiagramCraftSchema
} from './public-transforms.js';
import type { Entity, EntitySchema } from '../types.js';

describe('public transforms', () => {
  it('keeps containment fields in public schema responses', () => {
    const schema: EntitySchema = {
      id: 'schema-1',
      workspace: 'default',
      name: 'Component',
      description: '',
      color: null,
      icon: null,
      default_owner: null,
      created_at: new Date(),
      updated_at: new Date(),
      fields: [
        { id: 'name', name: 'Name', type: 'text' },
        {
          id: 'system',
          name: 'System',
          type: 'containment',
          schemaId: 'schema-2',
          minCount: 0,
          maxCount: 1
        }
      ]
    };

    expect(toDiagramCraftField(schema.fields[1]!)).toEqual(schema.fields[1]);
    expect(toDiagramCraftSchema(schema)).toEqual({
      id: 'schema-1',
      name: 'Component',
      fields: [
        { id: 'description', name: 'Description', type: 'longtext' },
        ...schema.fields
      ]
    });
  });

  it('adds name and description metadata fields when missing', () => {
    const schema: EntitySchema = {
      id: 'schema-1',
      workspace: 'default',
      name: 'Component',
      description: '',
      color: null,
      icon: null,
      default_owner: null,
      created_at: new Date(),
      updated_at: new Date(),
      fields: [{ id: 'technology', name: 'Technology', type: 'text' }]
    };

    expect(toDiagramCraftSchema(schema)).toEqual({
      id: 'schema-1',
      name: 'Component',
      fields: [
        { id: 'name', name: 'Name', type: 'text' },
        { id: 'description', name: 'Description', type: 'longtext' },
        { id: 'technology', name: 'Technology', type: 'text' }
      ]
    });
  });

  it('keeps date fields in public schema output', () => {
    expect(
      toDiagramCraftField({ id: 'go_live', name: 'Go Live', type: 'date' })
    ).toEqual({
      id: 'go_live',
      name: 'Go Live',
      type: 'date'
    });
  });

  it('projects entity rows to diagram craft data responses', () => {
    const row: Entity = {
      id: 'entity-1',
      workspace: 'default',
      slug: 'payment-service',
      namespace: 'core',
      name: 'Payment Service',
      description: 'Processes payments',
      owner: 'payments',
      lifecycle: 'prod',
      tags: ['public'],
      links: [{ url: 'https://example.com', title: 'Docs' }],
      schema_id: 'schema-1',
      data: {
        technology: 'Java',
        system: 'entity-2'
      },
      visibility_mode: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    expect(toDiagramCraftData(row)).toEqual({
      _uid: 'entity-1',
      _workspace: 'default',
      _schemaId: 'schema-1',
      _name: 'Payment Service',
      _slug: 'payment-service',
      _namespace: 'core',
      _description: 'Processes payments',
      _owner: 'payments',
      _lifecycle: 'prod',
      _tags: ['public'],
      _links: [{ url: 'https://example.com', title: 'Docs' }],
      _visibilityMode: null,
      name: 'Payment Service',
      description: 'Processes payments',
      technology: 'Java',
      system: 'entity-2'
    });
  });
});
