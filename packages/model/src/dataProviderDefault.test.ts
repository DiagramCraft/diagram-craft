import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DefaultDataProvider } from './dataProviderDefault';
import { DataSchema } from './diagramDocumentDataSchemas';
import { Data } from './dataProvider';
import { Backends } from './collaboration/collaborationTestUtils';

describe.each(Backends.all())('DefaultDataProvider [%s]', (_name, backend) => {
  beforeEach(() => {
    backend.beforeEach();
  });

  afterEach(() => {
    backend.afterEach();
  });

  // Test data and schemas
  const testSchema: DataSchema = {
    id: 'test-schema',
    name: 'Test Schema',
    providerId: 'default',
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
    const [root1] = backend.syncedDocs();
    const p = new DefaultDataProvider(
      JSON.stringify({
        schemas: [],
        data: []
      })
    );
    p.setCRDT(root1);
    return p;
  };

  const createProviderWithSchemaAndData = () => {
    const [root1] = backend.syncedDocs();
    const p = new DefaultDataProvider(
      JSON.stringify({
        schemas: [testSchema],
        data: [
          { ...testData, _schemaId: testSchema.id },
          { ...testData2, _schemaId: testSchema.id }
        ]
      })
    );
    p.setCRDT(root1);
    return p;
  };

  const createSyncedProviders = () => {
    const [root1, root2] = backend.syncedDocs();

    const p1 = new DefaultDataProvider(
      JSON.stringify({
        schemas: [],
        data: []
      })
    );
    p1.setCRDT(root1);

    const p2 = root2
      ? new DefaultDataProvider(
          JSON.stringify({
            schemas: [],
            data: []
          })
        )
      : undefined;
    if (p2 && root2) {
      p2.setCRDT(root2);
    }

    return { provider1: p1, provider2: p2 };
  };

  const initializeTestData = (provider: DefaultDataProvider) => {
    // Note, ignoring the promise is ok in this situation as the
    // DefaultDataProvider is synchronous
    provider.addSchema(testSchema);
    provider.addData(testSchema, testData);
    provider.addData(testSchema, testData2);
  };

  describe('constructor', () => {
    it('should initialize with empty data and schemas when given empty JSON', () => {
      const [root1] = backend.syncedDocs();
      const provider = new DefaultDataProvider('{}');
      provider.setCRDT(root1);
      expect(provider.schemas).toEqual([]);
      expect(provider.getById([])).toEqual([]);
    });

    it('should initialize with provided data and schemas', () => {
      const provider = createProviderWithSchemaAndData();
      expect(provider.schemas).toEqual([testSchema]);
      expect(provider.getById([testData._uid])).toHaveLength(1);
      expect(provider.getById([testData._uid])[0]!._uid).toBe(testData._uid);
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
      expect(result[0]!._uid).toBe(testData._uid);
    });
  });

  describe('addData', () => {
    it('should add data and emit event', () => {
      const provider = createEmptyProvider();
      provider.addSchema(testSchema);

      // Set up event listener
      const addDataSpy = vi.fn();
      provider.on('addData', addDataSpy);

      // Act
      provider.addData(testSchema, testData);

      // Assert
      expect(provider.getData(testSchema)).toHaveLength(1);
      expect(provider.getData(testSchema)[0]!._uid).toBe(testData._uid);
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
      expect(remainingData[0]!._uid).toBe(testData2._uid);
      expect(deleteDataSpy).toHaveBeenCalledTimes(1);
      expect(deleteDataSpy).toHaveBeenCalledWith({ data: [testData] });
    });

    it('should do nothing if data does not exist', () => {
      const provider = createEmptyProvider();
      provider.addSchema(testSchema);

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
      const data = provider.getById([testData._uid])[0]!;
      expect(data.value).toBe('Updated Value');
      expect(updateDataSpy).toHaveBeenCalledTimes(1);
      expect(updateDataSpy).toHaveBeenCalledWith({ data: [updatedData] });
    });

    it('should do nothing if data does not exist', () => {
      const provider = createEmptyProvider();
      provider.addSchema(testSchema);

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
      expect(provider.schemas[0]!.name).toBe('Updated Schema Name');
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
      expect(parsed).toHaveProperty('schemas');
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

  describe('CRDT replication', () => {
    describe('data replication', () => {
      it('should replicate added data to synced provider', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        provider1.addSchema(testSchema);

        const addDataSpy = vi.fn();
        provider2.on('addData', addDataSpy);

        // Add data on provider1
        await provider1.addData(testSchema, testData);

        // Allow async event to process
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider2 received the data
        expect(addDataSpy).toHaveBeenCalled();
        expect(provider2.getById([testData._uid])).toHaveLength(1);
        expect(provider2.getById([testData._uid])[0]!._uid).toBe(testData._uid);
      });

      it('should replicate updated data to synced provider', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        initializeTestData(provider1);
        await new Promise(resolve => setTimeout(resolve, 10));

        const updateDataSpy = vi.fn();
        provider2.on('updateData', updateDataSpy);

        // Update data on provider1
        const updatedData = { ...testData, value: 'Updated Value' };
        await provider1.updateData(testSchema, updatedData);

        // Allow async event to process
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider2 received the update
        expect(updateDataSpy).toHaveBeenCalled();
        expect(provider2.getById([testData._uid])[0]!.value).toBe('Updated Value');
      });

      it('should replicate deleted data to synced provider', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        initializeTestData(provider1);
        await new Promise(resolve => setTimeout(resolve, 10));

        const deleteDataSpy = vi.fn();
        provider2.on('deleteData', deleteDataSpy);

        // Delete data on provider1
        await provider1.deleteData(testSchema, testData);

        // Allow async event to process
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider2 received the deletion
        expect(deleteDataSpy).toHaveBeenCalled();
        expect(provider2.getById([testData._uid])).toHaveLength(0);
      });
    });

    describe('schema replication', () => {
      it('should replicate added schema to synced provider', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        const addSchemaSpy = vi.fn();
        provider2.on('addSchema', addSchemaSpy);

        // Add schema on provider1
        await provider1.addSchema(testSchema);

        // Allow async event to process
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider2 received the schema
        expect(addSchemaSpy).toHaveBeenCalled();
        expect(provider2.schemas).toHaveLength(1);
        expect(provider2.schemas[0]!.id).toBe(testSchema.id);
      });

      it('should replicate updated schema to synced provider', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        initializeTestData(provider1);
        await new Promise(resolve => setTimeout(resolve, 10));

        const updateSchemaSpy = vi.fn();
        provider2.on('updateSchema', updateSchemaSpy);

        // Update schema on provider1
        const updatedSchema = { ...testSchema, name: 'Updated Schema Name' };
        await provider1.updateSchema(updatedSchema);

        // Allow async event to process
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider2 received the update
        expect(updateSchemaSpy).toHaveBeenCalled();
        expect(provider2.schemas[0]!.name).toBe('Updated Schema Name');
      });

      it('should replicate deleted schema to synced provider', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        initializeTestData(provider1);
        await new Promise(resolve => setTimeout(resolve, 10));

        const deleteSchemaSpy = vi.fn();
        provider2.on('deleteSchema', deleteSchemaSpy);

        // Delete schema on provider1
        await provider1.deleteSchema(testSchema);

        // Allow async event to process
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider2 received the deletion
        expect(deleteSchemaSpy).toHaveBeenCalled();
        expect(provider2.schemas).toHaveLength(0);
      });
    });

    describe('stored state initialization', () => {
      it('should properly initialize with stored state when setCRDT is called', () => {
        const [root1] = backend.syncedDocs();
        const p = new DefaultDataProvider(
          JSON.stringify({
            schemas: [testSchema],
            data: [
              { ...testData, _schemaId: testSchema.id },
              { ...testData2, _schemaId: testSchema.id }
            ]
          })
        );

        // Before setCRDT, schemas and data should be empty
        expect(p.schemas).toEqual([]);
        expect(p.getById([testData._uid])).toEqual([]);

        // After setCRDT, stored state should be loaded
        p.setCRDT(root1);

        expect(p.schemas).toHaveLength(1);
        expect(p.schemas[0]!.id).toBe(testSchema.id);
        expect(p.getById([testData._uid, testData2._uid])).toHaveLength(2);
      });

      it('should replicate initial state to synced provider', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        initializeTestData(provider1);

        // Allow async replication to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider2 has the same data as provider1
        expect(provider2.schemas).toHaveLength(1);
        expect(provider2.schemas[0]!.id).toBe(testSchema.id);
        expect(provider2.getById([testData._uid, testData2._uid])).toHaveLength(2);
      });
    });

    describe('bidirectional replication', () => {
      it('should replicate changes from provider2 to provider1', async () => {
        const { provider1, provider2 } = createSyncedProviders();
        if (!provider2) return; // Skip for noop backend

        initializeTestData(provider1);
        await new Promise(resolve => setTimeout(resolve, 10));

        const addDataSpy = vi.fn();
        provider1.on('addData', addDataSpy);

        const newData: Data = {
          _uid: 'test-data-3',
          name: 'Test Data 3',
          value: 'Value 3'
        };

        // Add data on provider2
        await provider2.addData(testSchema, newData);

        // Allow async event to process
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify provider1 received the data
        expect(addDataSpy).toHaveBeenCalled();
        expect(provider1.getById([newData._uid])).toHaveLength(1);
        expect(provider1.getById([newData._uid])[0]!._uid).toBe(newData._uid);
      });
    });
  });
});
