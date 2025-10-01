import { describe, test, expect } from 'vitest';
import { TestModel } from './test-support/builder';
import { DataSchema } from './diagramDocumentDataSchemas';
import { Data } from './dataProvider';
import { newid } from '@diagram-craft/utils/id';
import { DataManagerUndoableFacade } from './diagramDocumentDataUndoActions';

describe('DataManagerUndoableFacade', () => {
  test('should undo/redo addData', async () => {
    const d = TestModel.newDiagram();
    const db = d.document.data.db;
    const dbUndoable = new DataManagerUndoableFacade(d.undoManager, d.document.data.db);

    const schema: DataSchema = {
      id: 'test-schema',
      name: 'Test Schema',
      providerId: 'default',
      fields: [{ id: 'name', name: 'Name', type: 'text' }]
    };

    await dbUndoable.addSchema(schema, 'default');

    const data: Data = {
      _uid: newid(),
      name: 'Test Item'
    };

    await dbUndoable.addData(schema, data);

    expect(db.getData(schema)).toHaveLength(1);
    expect(db.getData(schema)[0]!.name).toBe('Test Item');

    d.undoManager.undo();
    expect(db.getData(schema)).toHaveLength(0);

    d.undoManager.redo();
    expect(db.getData(schema)).toHaveLength(1);
    expect(db.getData(schema)[0]!.name).toBe('Test Item');
  });

  test('should undo/redo updateData', async () => {
    const d = TestModel.newDiagram();
    const db = d.document.data.db;
    const dbUndoable = new DataManagerUndoableFacade(d.undoManager, d.document.data.db);

    const schema: DataSchema = {
      id: 'test-schema',
      name: 'Test Schema',
      providerId: 'default',
      fields: [{ id: 'name', name: 'Name', type: 'text' }]
    };

    await dbUndoable.addSchema(schema, 'default');

    const data: Data = {
      _uid: newid(),
      name: 'Original Name'
    };

    await dbUndoable.addData(schema, data);

    const updatedData: Data = {
      ...data,
      name: 'Updated Name'
    };

    await dbUndoable.updateData(schema, data, updatedData);

    expect(db.getData(schema)[0]!.name).toBe('Updated Name');

    d.undoManager.undo();
    expect(db.getData(schema)[0]!.name).toBe('Original Name');

    d.undoManager.redo();
    expect(db.getData(schema)[0]!.name).toBe('Updated Name');
  });

  test('should undo/redo deleteData', async () => {
    const d = TestModel.newDiagram();
    const db = d.document.data.db;
    const dbUndoable = new DataManagerUndoableFacade(d.undoManager, d.document.data.db);

    const schema: DataSchema = {
      id: 'test-schema',
      name: 'Test Schema',
      providerId: 'default',
      fields: [{ id: 'name', name: 'Name', type: 'text' }]
    };

    await dbUndoable.addSchema(schema, 'default');

    const data: Data = {
      _uid: newid(),
      name: 'Test Item'
    };

    await dbUndoable.addData(schema, data);

    await dbUndoable.deleteData(schema, data);

    expect(db.getData(schema)).toHaveLength(0);

    d.undoManager.undo();
    expect(db.getData(schema)).toHaveLength(1);
    expect(db.getData(schema)[0]!.name).toBe('Test Item');

    d.undoManager.redo();
    expect(db.getData(schema)).toHaveLength(0);
  });

  test('should undo/redo addSchema', async () => {
    const d = TestModel.newDiagram();
    const db = d.document.data.db;
    const dbUndoable = new DataManagerUndoableFacade(d.undoManager, d.document.data.db);

    const initialSchemaCount = db.schemas.length;

    const schema: DataSchema = {
      id: 'test-schema',
      name: 'Test Schema',
      providerId: 'default',
      fields: [{ id: 'name', name: 'Name', type: 'text' }]
    };

    await dbUndoable.addSchema(schema, 'default');

    expect(db.schemas.length).toBe(initialSchemaCount + 1);
    expect(db.schemas.find(s => s.id === 'test-schema')).toBeDefined();

    d.undoManager.undo();
    expect(db.schemas.length).toBe(initialSchemaCount);
    expect(db.schemas.find(s => s.id === 'test-schema')).toBeUndefined();

    d.undoManager.redo();
    expect(db.schemas.length).toBe(initialSchemaCount + 1);
    expect(db.schemas.find(s => s.id === 'test-schema')).toBeDefined();
  });

  test('should undo/redo updateSchema', async () => {
    const d = TestModel.newDiagram();
    const db = d.document.data.db;
    const dbUndoable = new DataManagerUndoableFacade(d.undoManager, d.document.data.db);

    const schema: DataSchema = {
      id: 'test-schema',
      name: 'Original Name',
      providerId: 'default',
      fields: [{ id: 'name', name: 'Name', type: 'text' }]
    };

    await dbUndoable.addSchema(schema, 'default');

    const updatedSchema: DataSchema = {
      ...schema,
      name: 'Updated Name'
    };

    await dbUndoable.updateSchema(schema, updatedSchema);

    expect(db.schemas.find(s => s.id === 'test-schema')!.name).toBe('Updated Name');

    d.undoManager.undo();
    expect(db.schemas.find(s => s.id === 'test-schema')!.name).toBe('Original Name');

    d.undoManager.redo();
    expect(db.schemas.find(s => s.id === 'test-schema')!.name).toBe('Updated Name');
  });

  test('should undo/redo deleteSchema', async () => {
    const d = TestModel.newDiagram();
    const db = d.document.data.db;
    const dbUndoable = new DataManagerUndoableFacade(d.undoManager, d.document.data.db);

    const schema: DataSchema = {
      id: 'test-schema',
      name: 'Test Schema',
      providerId: 'default',
      fields: [{ id: 'name', name: 'Name', type: 'text' }]
    };

    await dbUndoable.addSchema(schema, 'default');

    const schemaCountBeforeDelete = db.schemas.length;

    await dbUndoable.deleteSchema(schema);

    expect(db.schemas.length).toBe(schemaCountBeforeDelete - 1);
    expect(db.schemas.find(s => s.id === 'test-schema')).toBeUndefined();

    d.undoManager.undo();
    expect(db.schemas.length).toBe(schemaCountBeforeDelete);
    expect(db.schemas.find(s => s.id === 'test-schema')).toBeDefined();

    d.undoManager.redo();
    expect(db.schemas.length).toBe(schemaCountBeforeDelete - 1);
    expect(db.schemas.find(s => s.id === 'test-schema')).toBeUndefined();
  });
});
