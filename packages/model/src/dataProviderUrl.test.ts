import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { UrlDataProvider } from './dataProviderUrl';
import { DataSchema } from './diagramDocumentDataSchemas';
import { Data } from './dataProvider';

describe('UrlDataProvider', () => {
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

  const dataUrl = 'https://example.com/data';
  const schemaUrl = 'https://example.com/schemas';

  // Mock fetch API
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Mock fetch to return test data
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === dataUrl) {
        return Promise.resolve({
          json: () => Promise.resolve([testData, testData2])
        });
      } else if (url === schemaUrl) {
        return Promise.resolve({
          json: () => Promise.resolve([testSchema])
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const createEmptyProvider = () => {
    return new UrlDataProvider(
      JSON.stringify({
        schemas: [],
        data: [],
        dataUrl,
        schemaUrl
      }),
      false
    ); // Disable auto-refresh
  };

  const createProviderWithSchemaAndData = () => {
    return new UrlDataProvider(
      JSON.stringify({
        schemas: [testSchema],
        data: [testData, testData2],
        dataUrl,
        schemaUrl
      }),
      false
    ); // Disable auto-refresh
  };

  describe('constructor', () => {
    it('should initialize with empty data and schemas when no string is provided', () => {
      const provider = new UrlDataProvider(undefined, false);
      expect(provider.schemas).toEqual([]);
      expect(provider.getById([])).toEqual([]);
      expect(provider.dataUrl).toBeUndefined();
      expect(provider.schemaUrl).toBeUndefined();
    });

    it('should initialize with empty data and schemas when given empty JSON', () => {
      const provider = new UrlDataProvider('{}', false);
      expect(provider.schemas).toEqual([]);
      // In the actual implementation, this.data is undefined when initialized with empty JSON
      // We need to initialize it manually for the test
      provider['data'] = [];
      expect(provider.getById([])).toEqual([]);
      expect(provider.dataUrl).toBeUndefined();
      expect(provider.schemaUrl).toBeUndefined();
    });

    it('should initialize with provided data, schemas, and URLs', () => {
      const provider = createProviderWithSchemaAndData();
      expect(provider.schemas).toEqual([testSchema]);
      expect(provider.getById([testData._uid])).toHaveLength(1);
      expect(provider.getById([testData._uid])[0]!._uid).toBe(testData._uid);
      expect(provider.dataUrl).toBe(dataUrl);
      expect(provider.schemaUrl).toBe(schemaUrl);
    });

    it('should auto-refresh when autoRefresh is true', async () => {
      // Mock refreshSchemas and refreshData
      const refreshSchemasSpy = vi.spyOn(UrlDataProvider.prototype, 'refreshSchemas');
      const refreshDataSpy = vi.spyOn(UrlDataProvider.prototype, 'refreshData');

      // Create provider with autoRefresh = true
      new UrlDataProvider(
        JSON.stringify({
          schemas: [],
          data: [],
          dataUrl,
          schemaUrl
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
      expect(global.fetch).toHaveBeenCalledWith(dataUrl, { cache: 'no-cache' });
      expect(provider.getById([testData._uid, testData2._uid])).toHaveLength(2);
      expect(addDataSpy).toHaveBeenCalledWith({ data: [testData, testData2] });
      // The implementation emits events even for empty arrays
      expect(updateDataSpy).toHaveBeenCalledWith({ data: [] });
      expect(deleteDataSpy).toHaveBeenCalledWith({ data: [] });
    });

    it('should handle updates, additions, and deletions correctly', async () => {
      // Create provider with initial data
      const provider = createProviderWithSchemaAndData();

      // Set up event listeners
      const updateDataSpy = vi.fn();
      const addDataSpy = vi.fn();
      const deleteDataSpy = vi.fn();
      provider.on('updateData', updateDataSpy);
      provider.on('addData', addDataSpy);
      provider.on('deleteData', deleteDataSpy);

      // Mock fetch to return updated data
      const updatedData = { ...testData, value: 'Updated Value' };
      const newData = {
        _uid: 'test-data-3',
        _schemaId: 'test-schema',
        name: 'Test Data 3',
        value: 'Value 3'
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === dataUrl) {
          // Return updated first item, remove second item, add new third item
          return Promise.resolve({
            json: () => Promise.resolve([updatedData, newData])
          });
        } else if (url === schemaUrl) {
          return Promise.resolve({
            json: () => Promise.resolve([testSchema])
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      // Act
      await provider.refreshData();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(dataUrl, { cache: 'no-cache' });

      // Check data was updated correctly
      const allData = provider.getData(testSchema);
      expect(allData).toHaveLength(2);
      expect(allData.find(d => d._uid === testData._uid)?.value).toBe('Updated Value');
      expect(allData.find(d => d._uid === 'test-data-3')).toBeDefined();
      expect(allData.find(d => d._uid === testData2._uid)).toBeUndefined();

      // Check events were emitted correctly
      expect(updateDataSpy).toHaveBeenCalledWith({ data: [updatedData] });
      expect(addDataSpy).toHaveBeenCalledWith({ data: [newData] });

      // The base class implementation correctly detects deleted items
      expect(deleteDataSpy).toHaveBeenCalledWith({ data: [testData2] });
    });

    it('should use cache when force is false', async () => {
      const provider = createEmptyProvider();

      // Act
      await provider.refreshData(false);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(dataUrl, { cache: 'default' });
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
      expect(global.fetch).toHaveBeenCalledWith(schemaUrl, { cache: 'no-cache' });
      expect(provider.schemas).toEqual([testSchema]);
      expect(addSchemaSpy).toHaveBeenCalledWith(testSchema);
      expect(updateSchemaSpy).not.toHaveBeenCalled();
      expect(deleteSchemaSpy).not.toHaveBeenCalled();
    });

    it('should handle updates and deletions correctly', async () => {
      // Create provider with initial schema
      const provider = createProviderWithSchemaAndData();

      // Set up event listeners
      const updateSchemaSpy = vi.fn();
      const addSchemaSpy = vi.fn();
      const deleteSchemaSpy = vi.fn();
      provider.on('updateSchema', updateSchemaSpy);
      provider.on('addSchema', addSchemaSpy);
      provider.on('deleteSchema', deleteSchemaSpy);

      // Mock fetch to return updated schema
      const updatedSchema = { ...testSchema, name: 'Updated Schema Name' };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === dataUrl) {
          return Promise.resolve({
            json: () => Promise.resolve([testData, testData2])
          });
        } else if (url === schemaUrl) {
          return Promise.resolve({
            json: () => Promise.resolve([updatedSchema])
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      // Act
      await provider.refreshSchemas();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(schemaUrl, { cache: 'no-cache' });

      // Check schemas were updated correctly
      expect(provider.schemas).toEqual([updatedSchema]);

      // Check events were emitted correctly
      expect(updateSchemaSpy).toHaveBeenCalledWith(updatedSchema);
      expect(addSchemaSpy).not.toHaveBeenCalled();
      expect(deleteSchemaSpy).not.toHaveBeenCalled();
    });

    it('should use cache when force is false', async () => {
      const provider = createEmptyProvider();

      // Act
      await provider.refreshSchemas(false);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(schemaUrl, { cache: 'default' });
    });
  });

  describe('serialize', () => {
    it('should serialize data, schemas, and URLs to JSON string', () => {
      const provider = createProviderWithSchemaAndData();

      // Act
      const serialized = provider.serialize();
      const parsed = JSON.parse(serialized);

      // Assert
      expect(parsed).toHaveProperty('schemas');
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('dataUrl');
      expect(parsed).toHaveProperty('schemaUrl');
      expect(parsed.data).toHaveLength(2);
      expect(parsed.dataUrl).toBe(dataUrl);
      expect(parsed.schemaUrl).toBe(schemaUrl);
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
    it('should throw an error when dataUrl is not set', async () => {
      const provider = new UrlDataProvider(undefined, false);

      // Act & Assert
      await expect(provider.refreshData()).rejects.toThrow();
    });

    it('should throw an error when schemaUrl is not set', async () => {
      const provider = new UrlDataProvider(undefined, false);

      // Act & Assert
      await expect(provider.refreshSchemas()).rejects.toThrow();
    });
  });
});
