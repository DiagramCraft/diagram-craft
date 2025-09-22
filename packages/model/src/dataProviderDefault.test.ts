import { describe, expect, it, vi } from 'vitest';
import { DefaultDataProvider } from './dataProviderDefault';
import { DataSchema } from './diagramDocumentDataSchemas';
import { Data } from './dataProvider';

describe('DefaultDataProvider', () => {
  // Test data and schemas
  const testSchema: DataSchema = {
    id: 'test-schema',
    name: 'Test Schema',
    providerId: 'external',
    fields: [
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'value', name: 'Value', type: 'text' }
    ]
  };

  const testData: Data = {
    _uid: 'test-data-1',
    name: 'Test Data 1',
    value: 'Value 1'
  };

  const testData2: Data = {
    _uid: 'test-data-2',
    name: 'Test Data 2',
    value: 'Value 2'
  };

  const createEmptyProvider = () => {
    return new DefaultDataProvider(
      JSON.stringify({
        schemas: [],
        data: []
      })
    );
  };

  const createProviderWithSchemaAndData = () => {
    return new DefaultDataProvider(
      JSON.stringify({
        schemas: [testSchema],
        data: [
          { ...testData, _schemaId: testSchema.id },
          { ...testData2, _schemaId: testSchema.id }
        ]
      })
    );
  };

  describe('constructor', () => {
    it('should initialize with empty data and schemas when given empty JSON', () => {
      const provider = new DefaultDataProvider('{}');
      expect(provider.schemas).toEqual([]);
      expect(provider.getById([])).toEqual([]);
    });

    it('should initialize with provided data and schemas', () => {
      const provider = createProviderWithSchemaAndData();
      expect(provider.schemas).toEqual([testSchema]);
      expect(provider.getById([testData._uid])).toHaveLength(1);
      expect(provider.getById([testData._uid])[0]._uid).toBe(testData._uid);
    });
  });

  describe('getById', () => {
    it('should return empty array when no matching ids are found', () => {
      const provider = createEmptyProvider();
      expect(provider.getById(['non-existent-id'])).toEqual([]);
    });

    it('should return matching data items by id', () => {
      const provider = createProviderWithSchemaAndData();
      const result = provider.getById([testData._uid, testData2._uid]);
      expect(result).toHaveLength(2);
      expect(result.map(d => d._uid).sort()).toEqual([testData._uid, testData2._uid].sort());
    });
  });

  describe('getData', () => {
    it('should return empty array when no data matches the schema', () => {
      const provider = createEmptyProvider();
      expect(provider.getData(testSchema)).toEqual([]);
    });

    it('should return all data items for a given schema', () => {
      const provider = createProviderWithSchemaAndData();
      const result = provider.getData(testSchema);
      expect(result).toHaveLength(2);
      expect(result.map(d => d._uid).sort()).toEqual([testData._uid, testData2._uid].sort());
    });
  });

  describe('queryData', () => {
    it('should return empty array when no data matches the query', () => {
      const provider = createProviderWithSchemaAndData();
      const result = provider.queryData(testSchema, 'non-existent');
      expect(result).toEqual([]);
    });

    it('should return data items that match the query', () => {
      const provider = createProviderWithSchemaAndData();
      const result = provider.queryData(testSchema, 'Value 1');
      expect(result).toHaveLength(1);
      expect(result[0]._uid).toBe(testData._uid);
    });
  });

  describe('addData', () => {
    it('should add data and emit event', () => {
      const provider = createEmptyProvider();
      provider.schemas.push(testSchema);

      // Set up event listener
      const addDataSpy = vi.fn();
      provider.on('addData', addDataSpy);

      // Act
      provider.addData(testSchema, testData);

      // Assert
      expect(provider.getData(testSchema)).toHaveLength(1);
      expect(provider.getData(testSchema)[0]._uid).toBe(testData._uid);
      expect(addDataSpy).toHaveBeenCalledTimes(1);
      expect(addDataSpy).toHaveBeenCalledWith({ data: [testData] });
    });
  });

  describe('deleteData', () => {
    it('should delete data and emit event', () => {
      const provider = createProviderWithSchemaAndData();

      // Set up event listener
      const deleteDataSpy = vi.fn();
      provider.on('deleteData', deleteDataSpy);

      // Act
      provider.deleteData(testSchema, testData);

      // Assert
      const remainingData = provider.getData(testSchema);
      expect(remainingData).toHaveLength(1);
      expect(remainingData[0]._uid).toBe(testData2._uid);
      expect(deleteDataSpy).toHaveBeenCalledTimes(1);
      expect(deleteDataSpy).toHaveBeenCalledWith({ data: [testData] });
    });

    it('should do nothing if data does not exist', () => {
      const provider = createEmptyProvider();
      provider.schemas.push(testSchema);

      // Set up event listener
      const deleteDataSpy = vi.fn();
      provider.on('deleteData', deleteDataSpy);

      // Act
      provider.deleteData(testSchema, testData);

      // Assert
      expect(deleteDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateData', () => {
    it('should update data and emit event', () => {
      const provider = createProviderWithSchemaAndData();

      // Set up event listener
      const updateDataSpy = vi.fn();
      provider.on('updateData', updateDataSpy);

      // Create updated data
      const updatedData = { ...testData, value: 'Updated Value' };

      // Act
      provider.updateData(testSchema, updatedData);

      // Assert
      const data = provider.getById([testData._uid])[0];
      expect(data.value).toBe('Updated Value');
      expect(updateDataSpy).toHaveBeenCalledTimes(1);
      expect(updateDataSpy).toHaveBeenCalledWith({ data: [updatedData] });
    });

    it('should do nothing if data does not exist', () => {
      const provider = createEmptyProvider();
      provider.schemas.push(testSchema);

      // Set up event listener
      const updateDataSpy = vi.fn();
      provider.on('updateData', updateDataSpy);

      // Act
      provider.updateData(testSchema, testData);

      // Assert
      expect(updateDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateSchema', () => {
    it('should update schema', async () => {
      const provider = createProviderWithSchemaAndData();

      // Create updated schema
      const updatedSchema = { ...testSchema, name: 'Updated Schema Name' };

      // Act
      await provider.updateSchema(updatedSchema);

      // Assert
      expect(provider.schemas[0].name).toBe('Updated Schema Name');
    });

    it('should do nothing if schema does not exist', async () => {
      const provider = createEmptyProvider();

      // Create a schema that doesn't exist in the provider
      const nonExistentSchema = { ...testSchema, id: 'non-existent-schema' };

      // Act
      await provider.updateSchema(nonExistentSchema);

      // Assert
      expect(provider.schemas).toHaveLength(0);
    });
  });

  describe('deleteSchema', () => {
    it('should delete schema', async () => {
      const provider = createProviderWithSchemaAndData();

      // Act
      await provider.deleteSchema(testSchema);

      // Assert
      expect(provider.schemas).toHaveLength(0);
    });

    it('should do nothing if schema does not exist', async () => {
      const provider = createEmptyProvider();

      // Act
      await provider.deleteSchema(testSchema);

      // Assert
      expect(provider.schemas).toHaveLength(0);
    });
  });

  describe('serialize', () => {
    it('should serialize data and schemas to JSON string', () => {
      const provider = createProviderWithSchemaAndData();

      // Act
      const serialized = provider.serialize();
      const parsed = JSON.parse(serialized);

      // Assert
      expect(parsed).toHaveProperty('schema');
      expect(parsed).toHaveProperty('data');
      expect(parsed.data).toHaveLength(2);
    });
  });

  describe('verifySettings', () => {
    it('should return undefined', async () => {
      const provider = createEmptyProvider();

      // Act
      const result = await provider.verifySettings();

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
