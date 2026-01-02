import { describe, expect, test, vi } from 'vitest';
import {
  DataSchema,
  DiagramDocumentDataSchemas,
  SchemaMetadata
} from './diagramDocumentDataSchemas';
import { CRDT } from '@diagram-craft/collaboration/crdt';
import { TestModel } from './test-support/testModel';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import { UOW } from './uow';

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

  describe('getMetadata', () => {
    test('should return empty object for schema without metadata', () => {
      const diagramSchemas = new DiagramDocumentDataSchemas(
        CRDT.makeRoot(),
        TestModel.newDocument()
      );
      const schema: DataSchema = {
        id: '1',
        name: 'TestSchema',
        providerId: 'document',
        fields: []
      };
      diagramSchemas.add(schema);

      const metadata = diagramSchemas.getMetadata('1');

      expect(metadata).toEqual({
        availableForElementLocalData: false,
        useDocumentOverrides: false
      });
    });

    test('should return metadata after it has been set', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataSchemas(root1, TestModel.newDocument());
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      const schema: DataSchema = {
        id: '1',
        name: 'TestSchema',
        providerId: 'document',
        fields: []
      };
      instance1.add(schema);

      const metadata: SchemaMetadata = {
        availableForElementLocalData: true,
        useDocumentOverrides: false
      };

      // Act
      instance1.setMetadata('1', metadata);

      // Verify
      expect(instance1.getMetadata('1')).toEqual(metadata);
      if (instance2) {
        expect(instance2.getMetadata('1')).toEqual(metadata);
      }
    });
  });

  describe('setMetadata', () => {
    test('should set metadata and emit update event', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataSchemas(root1, TestModel.newDocument());
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      const schema: DataSchema = {
        id: '1',
        name: 'TestSchema',
        providerId: 'document',
        fields: []
      };
      instance1.add(schema);

      const updateListener1 = vi.fn();
      instance1.on('update', updateListener1);

      const updateListener2 = vi.fn();
      instance2?.on('update', updateListener2);

      const metadata: SchemaMetadata = {
        availableForElementLocalData: true,
        useDocumentOverrides: true
      };

      // Act
      instance1.setMetadata('1', metadata);

      // Verify
      expect(updateListener1).toHaveBeenCalledWith({ schema });
      if (instance2) {
        expect(updateListener2).toHaveBeenCalledTimes(1);
      }
    });

    test('should update existing metadata', () => {
      const diagramSchemas = new DiagramDocumentDataSchemas(
        CRDT.makeRoot(),
        TestModel.newDocument()
      );
      const schema: DataSchema = {
        id: '1',
        name: 'TestSchema',
        providerId: 'document',
        fields: []
      };
      diagramSchemas.add(schema);

      const metadata1: SchemaMetadata = {
        availableForElementLocalData: true,
        useDocumentOverrides: false
      };
      diagramSchemas.setMetadata('1', metadata1);

      const metadata2: SchemaMetadata = {
        availableForElementLocalData: false,
        useDocumentOverrides: true
      };
      diagramSchemas.setMetadata('1', metadata2);

      expect(diagramSchemas.getMetadata('1')).toEqual(metadata2);
    });
  });

  describe('remove', () => {
    test('should remove schema metadata when schema is deleted', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const diagram1 = TestModel.newDiagram();
      const document1 = diagram1.document;
      const instance1 = new DiagramDocumentDataSchemas(root1, document1);
      const instance2 = root2
        ? new DiagramDocumentDataSchemas(root2, TestModel.newDocument())
        : undefined;

      const schema: DataSchema = {
        id: '1',
        name: 'TestSchema',
        providerId: 'document',
        fields: []
      };
      instance1.add(schema);

      const metadata: SchemaMetadata = {
        availableForElementLocalData: true,
        useDocumentOverrides: false
      };
      instance1.setMetadata('1', metadata);

      // Verify metadata is set
      expect(instance1.getMetadata('1')).toEqual(metadata);

      // Act - remove the schema
      UOW.execute(diagram1, () => instance1.removeAndClearUsage(schema, UOW.uow()));

      // Verify - metadata should be removed
      expect(instance1.getMetadata('1')).toEqual({
        availableForElementLocalData: false,
        useDocumentOverrides: false
      });
      if (instance2) {
        expect(instance2.getMetadata('1')).toEqual({
          availableForElementLocalData: false,
          useDocumentOverrides: false
        });
      }
    });
  });
});
