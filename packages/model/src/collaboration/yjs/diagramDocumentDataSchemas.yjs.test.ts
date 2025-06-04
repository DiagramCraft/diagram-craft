import { describe, expect, test, vi } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { DataSchema, DiagramDocumentDataSchemas } from '../../diagramDocumentDataSchemas';
import { TestModel } from '../../test-support/builder';

describe('YJS DiagramDocumentDataSchemas', () => {
  setupYJS();

  test('should initialize with empty schemas if no initial schemas provided', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataSchemas(doc1, TestModel.newDocument());
    const instance2 = new DiagramDocumentDataSchemas(doc2, TestModel.newDocument());

    expect(instance1.all).toEqual([]);
    expect(instance2.all).toEqual([]);
  });

  test('should replace schemas when initial schemas are provided', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const initialSchemas: DataSchema[] = [
      { id: '1', name: 'test', source: 'document', fields: [] }
    ];

    const instance1 = new DiagramDocumentDataSchemas(doc1, TestModel.newDocument(), initialSchemas);
    const instance2 = new DiagramDocumentDataSchemas(doc2, TestModel.newDocument());

    expect(instance1.all).toEqual(initialSchemas);
    expect(instance2.all).toEqual(initialSchemas);
  });

  test('should add new schema and emit event', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataSchemas(doc1, TestModel.newDocument());
    const instance2 = new DiagramDocumentDataSchemas(doc2, TestModel.newDocument());

    const newSchema: DataSchema = { id: '1', name: 'NewSchema', source: 'document', fields: [] };

    const addListener = vi.fn();
    instance1.on('add', addListener);
    instance2.on('add', addListener);

    instance1.add(newSchema);

    expect(addListener).toHaveBeenCalledTimes(2);
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

    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataSchemas(doc1, TestModel.newDocument());
    const instance2 = new DiagramDocumentDataSchemas(doc2, TestModel.newDocument());

    instance1.add(schemaToUpdate);

    const updateListener = vi.fn();
    instance1.on('update', updateListener);
    instance2.on('update', updateListener);

    instance1.update(updatedSchema);

    expect(instance1.all[0].name).toBe(updatedSchema.name);
    expect(instance2.all[0].name).toBe(updatedSchema.name);
    expect(updateListener).toHaveBeenCalledTimes(2);
  });
});
