import { describe, expect, test, vi } from 'vitest';
import { DataSchema, DiagramDocumentDataSchemas } from './diagramDocumentDataSchemas';
import { CRDT } from './collaboration/crdt';
import { TestModel } from './test-support/builder';
import { Backends } from './collaboration/collaborationTestUtils';

describe.each(Backends.all())('DiagramDocumentDataSchemas [%s]', (_name, backend) => {
  describe('constructor', () => {
    test('should initialize with empty schemas if no initial schemas provided', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataSchemas(root1, TestModel.newDocument());
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      // Verify
      expect(instance1.all).toEqual([]);
      if (instance2) expect(instance2.all).toEqual([]);
    });

    test('should replace schemas when initial schemas are provided', () => {
      const initialSchemas: DataSchema[] = [
        { id: '1', name: 'test', providerId: 'document', fields: [] }
      ];
      const diagramSchemas = new DiagramDocumentDataSchemas(
        CRDT.makeRoot(),
        TestModel.newDocument(),
        initialSchemas
      );

      expect(diagramSchemas.all).toEqual(initialSchemas);
    });
  });

  describe('get', () => {
    test('should return default empty schema when get() is called with unknown id', () => {
      const diagramSchemas = new DiagramDocumentDataSchemas(
        CRDT.makeRoot(),
        TestModel.newDocument()
      );
      const schema = diagramSchemas.get('unknown-id');

      expect(schema).toEqual({ id: '', name: '', providerId: 'document', fields: [] });
    });
  });

  describe('has', () => {
    test('should return true if schema with given id exists', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataSchemas(root1, TestModel.newDocument());
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      // Act
      const newSchema: DataSchema = {
        id: '1',
        name: 'NewSchema',
        providerId: 'document',
        fields: []
      };
      instance1.add(newSchema);

      // Verify
      expect(instance1.has('1')).toBe(true);
      expect(instance1.has('2')).toBe(false);
      if (instance2) {
        expect(instance2.has('1')).toBe(true);
        expect(instance2.has('2')).toBe(false);
      }
    });
  });

  describe('add', () => {
    test('should add new schema and emit event', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataSchemas(root1, TestModel.newDocument());
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      const addListener1 = vi.fn();
      instance1.on('add', addListener1);

      const addListener2 = vi.fn();
      instance2?.on('add', addListener2);

      // Act
      const newSchema: DataSchema = {
        id: '1',
        name: 'NewSchema',
        providerId: 'document',
        fields: []
      };
      instance1.add(newSchema);

      // Verify
      expect(addListener1).toHaveBeenCalledWith({ schema: newSchema });
      if (instance2) expect(addListener2).toHaveBeenCalledTimes(1);
    });

    test('should update schema if it already exists', () => {
      // Setup
      const existingSchema: DataSchema = {
        id: '1',
        name: 'ExistingSchema',
        providerId: 'document',
        fields: []
      };
      const updatedSchema: DataSchema = {
        id: '1',
        name: 'UpdatedSchema',
        providerId: 'document',
        fields: [{ id: 'test', name: 'name', type: 'text' }]
      };

      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataSchemas(root1, TestModel.newDocument());
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      instance1.add(existingSchema);

      const updateListener1 = vi.fn();
      instance1.on('update', updateListener1);

      const updateListener2 = vi.fn();
      instance2?.on('update', updateListener2);

      // Act
      instance1.add(updatedSchema);

      // Verify
      expect(existingSchema.name).toBe(updatedSchema.name);
      expect(existingSchema.fields).toEqual(updatedSchema.fields);
      expect(updateListener1).toHaveBeenCalledWith({ schema: updatedSchema });
      if (instance2) {
        expect(instance2.all[0]!.name).toBe(updatedSchema.name);
        expect(updateListener2).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('replaceBy', () => {
    test('should replace all schemas when replaceBy is called', () => {
      // Setup
      const newSchemas: DataSchema[] = [
        { id: '1', name: 'Schema1', providerId: 'document', fields: [] },
        { id: '2', name: 'Schema2', providerId: 'document', fields: [] }
      ];

      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataSchemas(root1, TestModel.newDocument());
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      // Act
      instance1.replaceBy(newSchemas);

      // Verify
      expect(instance1.all).toEqual(newSchemas);
      if (instance2) expect(instance2.all).toEqual(newSchemas);
    });
  });
});
