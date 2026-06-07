import { describe, expect, it } from 'vitest';
import {
  toDiagramCraftData,
  toDiagramCraftField,
  toDiagramCraftSchema
} from './diagram-craft-transforms.js';
import type { Entity, EntitySchema } from '../types.js';

describe('diagram craft transforms', () => {
  it('keeps containment fields in diagram craft schema responses', () => {
    const schema = {
      id: 'schema-1',
      name: 'System',
      fields: [
        { id: 'system', name: 'System', type: 'containment', schemaId: 'schema-2' },
        { id: 'depends_on', name: 'Depends on', type: 'reference', schemaId: 'schema-2' }
      ]
    } as EntitySchema;

    expect(toDiagramCraftSchema(schema)).toEqual({
      id: 'schema-1',
      name: 'System',
      fields: [
        { id: 'name', name: 'Name', type: 'text' },
        { id: 'description', name: 'Description', type: 'longtext' },
        { id: 'system', name: 'System', type: 'containment', schemaId: 'schema-2' },
        { id: 'depends_on', name: 'Depends on', type: 'reference', schemaId: 'schema-2' }
      ]
    });
  });

  it('adds name and description metadata fields when missing', () => {
    const schema = {
      id: 'schema-1',
      name: 'Component',
      fields: [{ id: 'technology', name: 'Technology', type: 'text' }]
    } as EntitySchema;

    expect(toDiagramCraftSchema(schema).fields).toEqual([
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'description', name: 'Description', type: 'longtext' },
      { id: 'technology', name: 'Technology', type: 'text' }
    ]);
  });

  it('keeps date fields in diagram craft schema output', () => {
    expect(
      toDiagramCraftField({ id: 'go_live', name: 'Go Live', type: 'date' } as never)
    ).toEqual({
      id: 'go_live',
      name: 'Go Live',
      type: 'date'
    });
  });

  it('projects entity rows to diagram craft data responses', () => {
    const row = {
      id: 'entity-1',
      workspace: 'default',
      schema_id: 'schema-1',
      name: 'Frontend App',
      slug: 'frontend-app',
      namespace: 'default',
      description: 'React SPA',
      owner: 'Design Systems',
      lifecycle: 'production',
      tags: ['react'],
      links: [],
      visibility_mode: 'workspace',
      created_at: new Date('2026-06-06T00:00:00.000Z'),
      updated_at: new Date('2026-06-06T00:00:00.000Z'),
      data: {
        technology: 'React',
        system: 'system-1'
      }
    } as unknown as Entity;

    expect(toDiagramCraftData(row)).toEqual({
      _uid: 'entity-1',
      _workspace: 'default',
      _schemaId: 'schema-1',
      _name: 'Frontend App',
      _slug: 'frontend-app',
      _namespace: 'default',
      _description: 'React SPA',
      _owner: 'Design Systems',
      _lifecycle: 'production',
      _tags: ['react'],
      _links: [],
      _visibilityMode: 'workspace',
      name: 'Frontend App',
      description: 'React SPA',
      technology: 'React',
      system: 'system-1'
    });
  });
});
