import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RESTDataProvider } from './dataProviderRest';
import { DataSchema } from './diagramDocumentDataSchemas';
import { Data } from './dataProvider';

describe('RESTDataProvider', () => {
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

  const testData: Data & { _schemaId: string } = {
    _uid: 'test-data-1',
    _schemaId: 'test-schema',
    name: 'Test Data 1',
    value: 'Value 1'
  };

  const testData2: Data & { _schemaId: string } = {
    _uid: 'test-data-2',
    _schemaId: 'test-schema',
    name: 'Test Data 2',
    value: 'Value 2'
  };

  const baseUrl = 'https://api.example.com';

  // Mock fetch API
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Mock fetch to return test data
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method || 'GET';

      if (url === `${baseUrl}/data` && method === 'GET') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([testData, testData2]) });
      } else if (url === `${baseUrl}/schemas` && method === 'GET') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([testSchema]) });
      } else if (url === `${baseUrl}/data` && method === 'POST') {
        const body = JSON.parse(options?.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...body, _uid: 'new-id' })
        });
      } else if (url.startsWith(`${baseUrl}/data/`) && method === 'PUT') {
        const body = JSON.parse(options?.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(body)
        });
      } else if (url.startsWith(`${baseUrl}/data/`) && method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      } else if (url === `${baseUrl}/schemas` && method === 'POST') {
        const body = JSON.parse(options?.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...body })
        });
      } else if (url.startsWith(`${baseUrl}/schemas/`) && method === 'PUT') {
        const body = JSON.parse(options?.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(body)
        });
      } else if (url.startsWith(`${baseUrl}/schemas/`) && method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url} ${method}`));
    });
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const createEmptyProvider = () => {
    return new RESTDataProvider(
      JSON.stringify({
        schemas: [],
        data: [],
        baseUrl
      }),
      false
    );
  };

  const createProviderWithSchemaAndData = () => {
    return new RESTDataProvider(
      JSON.stringify({
        schemas: [testSchema],
        data: [testData, testData2],
        baseUrl
      }),
      false
    );
  };

  describe('constructor', () => {
    it('should initialize with empty data and schemas when no string is provided', () => {
      const provider = new RESTDataProvider(undefined, false);
      expect(provider.schemas).toEqual([]);
      expect(provider.getById([])).toEqual([]);
      expect(provider.baseUrl).toBeUndefined();
    });

    it('should initialize with empty data and schemas when given empty JSON', () => {
      const provider = new RESTDataProvider('{}', false);
      expect(provider.schemas).toEqual([]);
      expect(provider.getById([])).toEqual([]);
      expect(provider.baseUrl).toBeUndefined();
    });

    it('should initialize with provided data, schemas, and baseUrl', () => {
      const provider = createProviderWithSchemaAndData();
      expect(provider.schemas).toEqual([testSchema]);
      expect(provider.getById([testData._uid])).toHaveLength(1);
      expect(provider.getById([testData._uid])[0]!._uid).toBe(testData._uid);
      expect(provider.baseUrl).toBe(baseUrl);
    });

    it('should auto-refresh when autoRefresh is true', async () => {
      // Mock refreshSchemas and refreshData
      const refreshSchemasSpy = vi.spyOn(RESTDataProvider.prototype, 'refreshSchemas');
      const refreshDataSpy = vi.spyOn(RESTDataProvider.prototype, 'refreshData');

      // Create provider with autoRefresh = true
      new RESTDataProvider(
        JSON.stringify({
          schemas: [],
          data: [],
          baseUrl
        }),
        true
      );

      // Wait for promises to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify refreshSchemas was called
      expect(refreshSchemasSpy).toHaveBeenCalledWith(false);

      // Wait for refreshSchemas promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify refreshData was called
      expect(refreshDataSpy).toHaveBeenCalledWith(false);

      // Restore original methods
      refreshSchemasSpy.mockRestore();
      refreshDataSpy.mockRestore();
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
    it('should make POST request to create new data', async () => {
      const provider = createProviderWithSchemaAndData();

      // Set up event listener
      const addDataSpy = vi.fn();
      provider.on('addData', addDataSpy);

      const newData: Data = {
        _uid: 'temp-id',
        name: 'New Item',
        value: 'New Value'
      };

      // Act
      await provider.addData(testSchema, newData);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...newData, _schemaId: testSchema.id })
        })
      );

      // Check event was emitted
      expect(addDataSpy).toHaveBeenCalledWith({
        data: [{ ...newData, _schemaId: testSchema.id, _uid: 'new-id' }]
      });
    });

    it('should throw error when POST request fails', async () => {
      const provider = createProviderWithSchemaAndData();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request'
      });

      const newData: Data = {
        _uid: 'temp-id',
        name: 'New Item',
        value: 'New Value'
      };

      // Act & Assert
      await expect(provider.addData(testSchema, newData)).rejects.toThrow(
        'Failed to add data: Bad Request'
      );
    });

    it('should throw error when baseUrl is not set', async () => {
      const provider = new RESTDataProvider(undefined, false);

      const newData: Data = {
        _uid: 'temp-id',
        name: 'New Item',
        value: 'New Value'
      };

      // Act & Assert
      await expect(provider.addData(testSchema, newData)).rejects.toThrow();
    });
  });

  describe('updateData', () => {
    it('should make PUT request to update existing data', async () => {
      const provider = createProviderWithSchemaAndData();

      // Set up event listener
      const updateDataSpy = vi.fn();
      provider.on('updateData', updateDataSpy);

      const updatedData: Data = {
        _uid: testData._uid,
        name: 'Updated Name',
        value: 'Updated Value'
      };

      // Act
      await provider.updateData(testSchema, updatedData);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data/${testData._uid}`,
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...updatedData, _schemaId: testSchema.id })
        })
      );

      // Check event was emitted
      expect(updateDataSpy).toHaveBeenCalledWith({
        data: [{ ...updatedData, _schemaId: testSchema.id }]
      });
    });

    it('should throw error when PUT request fails', async () => {
      const provider = createProviderWithSchemaAndData();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      const updatedData: Data = {
        _uid: testData._uid,
        name: 'Updated Name',
        value: 'Updated Value'
      };

      // Act & Assert
      await expect(provider.updateData(testSchema, updatedData)).rejects.toThrow(
        'Failed to update data: Not Found'
      );
    });

    it('should throw error when baseUrl is not set', async () => {
      const provider = new RESTDataProvider(undefined, false);

      const updatedData: Data = {
        _uid: testData._uid,
        name: 'Updated Name',
        value: 'Updated Value'
      };

      // Act & Assert
      await expect(provider.updateData(testSchema, updatedData)).rejects.toThrow();
    });
  });

  describe('deleteData', () => {
    it('should make DELETE request to remove data', async () => {
      const provider = createProviderWithSchemaAndData();

      // Set up event listener
      const deleteDataSpy = vi.fn();
      provider.on('deleteData', deleteDataSpy);

      // Act
      await provider.deleteData(testSchema, testData);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data/${testData._uid}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );

      // Check event was emitted
      expect(deleteDataSpy).toHaveBeenCalledWith({ data: [testData] });
    });

    it('should throw error when DELETE request fails', async () => {
      const provider = createProviderWithSchemaAndData();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      // Act & Assert
      await expect(provider.deleteData(testSchema, testData)).rejects.toThrow(
        'Failed to delete data: Not Found'
      );
    });

    it('should throw error when baseUrl is not set', async () => {
      const provider = new RESTDataProvider(undefined, false);

      // Act & Assert
      await expect(provider.deleteData(testSchema, testData)).rejects.toThrow();
    });
  });

  describe('refreshData', () => {
    it('should fetch new data and update internal state', async () => {
      const provider = createEmptyProvider();

      // Set up event listeners
      const updateDataSpy = vi.fn();
      const addDataSpy = vi.fn();
      const deleteDataSpy = vi.fn();
      provider.on('updateData', updateDataSpy);
      provider.on('addData', addDataSpy);
      provider.on('deleteData', deleteDataSpy);

      // Act
      await provider.refreshData();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data`,
        expect.objectContaining({
          method: 'GET',
          cache: 'no-cache'
        })
      );
      expect(provider.getById([testData._uid, testData2._uid])).toHaveLength(2);
      expect(addDataSpy).toHaveBeenCalledWith({ data: [testData, testData2] });
      expect(updateDataSpy).toHaveBeenCalledWith({ data: [] });
      expect(deleteDataSpy).toHaveBeenCalledWith({ data: [] });
    });

    it('should use cache when force is false', async () => {
      const provider = createEmptyProvider();

      // Act
      await provider.refreshData(false);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data`,
        expect.objectContaining({
          method: 'GET',
          cache: 'default'
        })
      );
    });

    it('should throw error when fetch fails', async () => {
      const provider = createEmptyProvider();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      });

      // Act & Assert
      await expect(provider.refreshData()).rejects.toThrow('Failed to fetch data: Server Error');
    });
  });

  describe('refreshSchemas', () => {
    it('should fetch new schemas and update internal state', async () => {
      const provider = createEmptyProvider();

      // Set up event listeners
      const updateSchemaSpy = vi.fn();
      const addSchemaSpy = vi.fn();
      const deleteSchemaSpy = vi.fn();
      provider.on('updateSchema', updateSchemaSpy);
      provider.on('addSchema', addSchemaSpy);
      provider.on('deleteSchema', deleteSchemaSpy);

      // Act
      await provider.refreshSchemas();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/schemas`,
        expect.objectContaining({
          method: 'GET',
          cache: 'no-cache'
        })
      );
      expect(provider.schemas).toEqual([testSchema]);
      expect(addSchemaSpy).toHaveBeenCalledWith(testSchema);
      expect(updateSchemaSpy).not.toHaveBeenCalled();
      expect(deleteSchemaSpy).not.toHaveBeenCalled();
    });

    it('should use cache when force is false', async () => {
      const provider = createEmptyProvider();

      // Act
      await provider.refreshSchemas(false);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/schemas`,
        expect.objectContaining({
          method: 'GET',
          cache: 'default'
        })
      );
    });

    it('should throw error when fetch fails', async () => {
      const provider = createEmptyProvider();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      });

      // Act & Assert
      await expect(provider.refreshSchemas()).rejects.toThrow(
        'Failed to fetch schemas: Server Error'
      );
    });
  });

  describe('serialize', () => {
    it('should serialize data, schemas, and baseUrl to JSON string', () => {
      const provider = createProviderWithSchemaAndData();

      // Act
      const serialized = provider.serialize();
      const parsed = JSON.parse(serialized);

      // Assert
      expect(parsed).toHaveProperty('schemas');
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('baseUrl');
      expect(parsed.data).toHaveLength(2);
      expect(parsed.baseUrl).toBe(baseUrl);
    });
  });

  describe('verifySettings', () => {
    it('should return undefined when fetch succeeds', async () => {
      const provider = createProviderWithSchemaAndData();

      // Act
      const result = await provider.verifySettings();

      // Assert
      expect(result).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return error message when fetch fails', async () => {
      const provider = createProviderWithSchemaAndData();

      // Mock fetch to throw error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act
      const result = await provider.verifySettings();

      // Assert
      expect(result).toContain('Error fetching data');
      expect(result).toContain('Network error');
    });
  });

  describe('fetchData and fetchSchemas', () => {
    it('should throw an error when baseUrl is not set for fetchData', async () => {
      const provider = new RESTDataProvider(undefined, false);

      // Act & Assert
      await expect(provider.refreshData()).rejects.toThrow();
    });

    it('should throw an error when baseUrl is not set for fetchSchemas', async () => {
      const provider = new RESTDataProvider(undefined, false);

      // Act & Assert
      await expect(provider.refreshSchemas()).rejects.toThrow();
    });
  });

  describe('CRUD operations integration', () => {
    it('should handle a complete CRUD workflow', async () => {
      const provider = createEmptyProvider();

      // Create
      const newData: Data = {
        _uid: 'temp-id',
        name: 'Integration Test Item',
        value: 'Test Value'
      };

      await provider.addData(testSchema, newData);

      // The mock returns a new ID
      const createdData = provider
        .getData(testSchema)
        .find(d => d.name === 'Integration Test Item');
      expect(createdData).toBeDefined();
      expect(createdData?._uid).toBe('new-id');

      // Update
      const updatedData: Data = {
        _uid: 'new-id',
        name: 'Updated Integration Test Item',
        value: 'Updated Test Value'
      };

      await provider.updateData(testSchema, updatedData);

      // Delete
      await provider.deleteData(testSchema, updatedData);

      // Verify all operations called fetch correctly
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data`,
        expect.objectContaining({ method: 'POST' })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data/new-id`,
        expect.objectContaining({ method: 'PUT' })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/data/new-id`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('addSchema', () => {
    it('should make POST request to add schema and emit events', async () => {
      const provider = createEmptyProvider();
      provider.id = 'external';

      const newSchema: DataSchema = {
        id: 'new-schema',
        name: 'New Schema',
        providerId: 'external',
        fields: [{ id: 'title', name: 'Title', type: 'text' }]
      };

      // Set up event listener
      const addSchemaSpy = vi.fn();
      provider.on('addSchema', addSchemaSpy);

      // Act
      await provider.addSchema(newSchema);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/schemas`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newSchema)
        })
      );

      expect(provider.schemas.find(s => s.id === newSchema.id)).toBeDefined();
      expect(addSchemaSpy).toHaveBeenCalledWith(newSchema);
    });

    it('should throw error when POST request fails', async () => {
      const provider = createEmptyProvider();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      });

      const newSchema: DataSchema = {
        id: 'new-schema',
        name: 'New Schema',
        providerId: 'external',
        fields: [{ id: 'title', name: 'Title', type: 'text' }]
      };

      // Act & Assert
      await expect(provider.addSchema(newSchema)).rejects.toThrow(
        'Failed to add schema: Server Error'
      );

      // Schema should not be added on failure
      expect(provider.schemas).not.toContain(newSchema);
    });
  });

  describe('updateSchema', () => {
    it('should make PUT request to update schema and emit events', async () => {
      const provider = createProviderWithSchemaAndData();

      const updatedSchema: DataSchema = {
        ...testSchema,
        name: 'Updated Schema Name'
      };

      // Set up event listener
      const updateSchemaSpy = vi.fn();
      provider.on('updateSchema', updateSchemaSpy);

      // Act
      await provider.updateSchema(updatedSchema);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/schemas/${testSchema.id}`,
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedSchema)
        })
      );

      expect(provider.schemas[0]!.name).toBe('Updated Schema Name');
      expect(updateSchemaSpy).toHaveBeenCalledWith(updatedSchema);
    });

    it('should throw error when PUT request fails', async () => {
      const provider = createProviderWithSchemaAndData();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      });

      const originalName = testSchema.name;
      const updatedSchema: DataSchema = {
        ...testSchema,
        name: 'Updated Schema Name'
      };

      // Act & Assert
      await expect(provider.updateSchema(updatedSchema)).rejects.toThrow(
        'Failed to update schema: Server Error'
      );

      // Schema should remain unchanged on failure
      expect(provider.schemas[0]!.name).toBe(originalName);
    });

    it('should do nothing when schema does not exist', async () => {
      const provider = createEmptyProvider();

      const nonExistentSchema: DataSchema = {
        id: 'non-existent',
        name: 'Non Existent',
        providerId: 'external',
        fields: []
      };

      // Act
      await provider.updateSchema(nonExistentSchema);

      // Assert - nothing should happen
      expect(provider.schemas).toHaveLength(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('deleteSchema', () => {
    it('should make DELETE request to remove schema and emit events', async () => {
      const provider = createProviderWithSchemaAndData();

      // Set up event listener
      const deleteSchemaSpy = vi.fn();
      provider.on('deleteSchema', deleteSchemaSpy);

      // Act
      await provider.deleteSchema(testSchema);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/schemas/${testSchema.id}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );

      expect(provider.schemas).not.toContain(testSchema);
      expect(deleteSchemaSpy).toHaveBeenCalledWith(testSchema);
    });

    it('should throw error when DELETE request fails', async () => {
      const provider = createProviderWithSchemaAndData();

      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      });

      // Act & Assert
      await expect(provider.deleteSchema(testSchema)).rejects.toThrow(
        'Failed to delete schema: Server Error'
      );

      // Schema should remain in the list on failure
      expect(provider.schemas.find(s => s.id === testSchema.id)).toBeDefined();
    });

    it('should do nothing when schema does not exist', async () => {
      const provider = createEmptyProvider();

      const nonExistentSchema: DataSchema = {
        id: 'non-existent',
        name: 'Non Existent',
        providerId: 'external',
        fields: []
      };

      // Act
      await provider.deleteSchema(nonExistentSchema);

      // Assert - nothing should happen
      expect(provider.schemas).toHaveLength(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
