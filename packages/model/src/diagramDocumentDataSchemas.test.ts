import { describe, expect, test, vi } from 'vitest';
import { DataSchema, DiagramDocumentDataSchemas } from './diagramDocumentDataSchemas';
import { CRDT } from './collaboration/crdt';
import { TestModel } from './test-support/builder';

describe('DiagramDocumentDataSchemas', () => {
  test('should initialize with empty schemas if no initial schemas provided', () => {
    const diagramSchemas = new DiagramDocumentDataSchemas(new CRDT.Root(), TestModel.newDocument());
    expect(diagramSchemas.all).toEqual([]);
  });

  test('should replace schemas when initial schemas are provided', () => {
    const initialSchemas: DataSchema[] = [
      { id: '1', name: 'test', source: 'document', fields: [] }
    ];
    const diagramSchemas = new DiagramDocumentDataSchemas(
      new CRDT.Root(),
      TestModel.newDocument(),
      initialSchemas
    );

    expect(diagramSchemas.all).toEqual(initialSchemas);
  });

  test('should return default empty schema when get() is called with unknown id', () => {
    const diagramSchemas = new DiagramDocumentDataSchemas(new CRDT.Root(), TestModel.newDocument());
    const schema = diagramSchemas.get('unknown-id');

    expect(schema).toEqual({ id: '', name: '', source: 'document', fields: [] });
  });

  test('should add new schema and emit event', () => {
    const diagramSchemas = new DiagramDocumentDataSchemas(new CRDT.Root(), TestModel.newDocument());
    const newSchema: DataSchema = { id: '1', name: 'NewSchema', source: 'document', fields: [] };

    const addListener = vi.fn();
    diagramSchemas.on('add', addListener);

    diagramSchemas.add(newSchema);

    expect(addListener).toHaveBeenCalledWith({ schema: newSchema });
  });

  test('should update schema if it already exists', () => {
    const existingSchema: DataSchema = {
      id: '1',
      name: 'ExistingSchema',
      source: 'document',
      fields: []
    };
    const updatedSchema: DataSchema = {
      id: '1',
      name: 'UpdatedSchema',
      source: 'document',
      fields: [{ id: 'test', name: 'name', type: 'text' }]
    };

    const diagramSchemas = new DiagramDocumentDataSchemas(new CRDT.Root(), TestModel.newDocument());
    diagramSchemas.add(existingSchema);

    const updateListener = vi.fn();
    diagramSchemas.on('update', updateListener);

    diagramSchemas.add(updatedSchema);

    expect(existingSchema.name).toBe(updatedSchema.name);
    expect(existingSchema.fields).toEqual(updatedSchema.fields);
    expect(updateListener).toHaveBeenCalledWith({ schema: updatedSchema });
  });

  test('should emit update event when schema is updated', () => {
    const schemaToUpdate: DataSchema = {
      id: '1',
      name: 'OldSchema',
      source: 'document',
      fields: []
    };
    const updatedSchema: DataSchema = {
      id: '1',
      name: 'UpdatedSchema',
      source: 'document',
      fields: []
    };

    const diagramSchemas = new DiagramDocumentDataSchemas(new CRDT.Root(), TestModel.newDocument());
    diagramSchemas.add(schemaToUpdate);

    const updateListener = vi.fn();
    diagramSchemas.on('update', updateListener);

    diagramSchemas.update(updatedSchema);

    expect(diagramSchemas.all[0].name).toBe(updatedSchema.name);
    expect(updateListener).toHaveBeenCalledWith({ schema: updatedSchema });
  });

  test('should replace all schemas when replaceBy is called', () => {
    const newSchemas: DataSchema[] = [
      { id: '1', name: 'Schema1', source: 'document', fields: [] },
      { id: '2', name: 'Schema2', source: 'document', fields: [] }
    ];

    const diagramSchemas = new DiagramDocumentDataSchemas(new CRDT.Root(), TestModel.newDocument());

    diagramSchemas.replaceBy(newSchemas);

    expect(diagramSchemas.all).toEqual(newSchemas);
  });
});
