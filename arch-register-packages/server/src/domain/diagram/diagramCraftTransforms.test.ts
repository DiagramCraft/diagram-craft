import { describe, expect, it } from 'vitest';
import {
  toDiagramCraftData,
  toDiagramCraftField,
  toDiagramCraftSchema
} from './diagramCraftTransforms';
import { Entity, SchemaDbResult, WorkspaceEnumDbResult } from '../catalog/db/catalogDatabase';

describe('diagram craft transforms', () => {
  it('keeps containment fields in diagram craft schema responses', () => {
    const schema = {
      id: 'schema-1',
      name: 'System',
      fields: [
        { id: 'system', name: 'System', type: 'containment', schemaId: 'schema-2' },
        { id: 'depends_on', name: 'Depends on', type: 'reference', schemaId: 'schema-2' }
      ]
    } as SchemaDbResult;

    expect(toDiagramCraftSchema(schema, [])).toEqual({
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
    } as SchemaDbResult;

    expect(toDiagramCraftSchema(schema, []).fields).toEqual([
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'description', name: 'Description', type: 'longtext' },
      { id: 'technology', name: 'Technology', type: 'text' }
    ]);
  });

  it('keeps date fields in diagram craft schema output', () => {
    expect(
      toDiagramCraftField({ id: 'go_live', name: 'Go Live', type: 'date' } as never, [])
    ).toEqual({
      id: 'go_live',
      name: 'Go Live',
      type: 'date'
    });
  });

  it('populates select field options from enums', () => {
    const enumId = 'enum-1';
    const enums: WorkspaceEnumDbResult[] = [
      {
        id: enumId,
        workspace: 'ws-1',
        name: 'My Enum',
        options: [
          { value: 'v1', label: 'L1' },
          { value: 'v2', label: 'L2' }
        ],
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const field = {
      id: 'choice',
      name: 'Choice',
      type: 'select',
      enumId: enumId
    } as any;

    expect(toDiagramCraftField(field, enums)).toEqual({
      id: 'choice',
      name: 'Choice',
      type: 'select',
      enumId: enumId,
      options: [
        { value: 'v1', label: 'L1' },
        { value: 'v2', label: 'L2' }
      ]
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
