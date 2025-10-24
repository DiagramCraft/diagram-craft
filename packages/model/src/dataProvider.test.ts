import { describe, expect, test, beforeEach } from 'vitest';
import {
  DataProviderQuery,
  DataProviderRegistry,
  isMutableDataProvider,
  isMutableSchemaProvider,
  type Data,
  type DataProvider
} from './dataProvider';

describe('DataProviderQuery', () => {
  test('matches query string in data fields', () => {
    const query = new DataProviderQuery('test');

    expect(query.matches({ _uid: '1', name: 'test user' })).toBe(true);
    expect(query.matches({ _uid: '1', name: 'other' })).toBe(false);
    expect(new DataProviderQuery('').matches({ _uid: '1', name: 'test' })).toBe(true);
  });

  test('handles undefined values and case sensitivity', () => {
    const query = new DataProviderQuery('test');
    const data = { _uid: '1', name: 'test', empty: undefined } as unknown as Data;

    expect(query.matches(data)).toBe(true);
    expect(new DataProviderQuery('TEST').matches({ _uid: '1', name: 'test' })).toBe(false);
  });
});

describe('DataProviderRegistry', () => {
  beforeEach(() => {
    DataProviderRegistry.providers.clear();
  });

  test('registers and retrieves provider factories', () => {
    const factory1 = (_s: string) => ({ providerId: 'test1' }) as unknown as DataProvider;
    const factory2 = (_s: string) => ({ providerId: 'test2' }) as unknown as DataProvider;

    DataProviderRegistry.register('type1', factory1);
    DataProviderRegistry.register('type2', factory2);

    expect(DataProviderRegistry.get('type1')).toBe(factory1);
    expect(DataProviderRegistry.get('type2')).toBe(factory2);
    expect(DataProviderRegistry.get('nonexistent')).toBeUndefined();
  });
});

describe('isMutableSchemaProvider', () => {
  test('detects schema mutation support', () => {
    const mutable = {
      addSchema: async () => {},
      updateSchema: async () => {},
      deleteSchema: async () => {}
    } as unknown as DataProvider;

    const incomplete = { addSchema: async () => {} } as unknown as DataProvider;

    expect(isMutableSchemaProvider(mutable)).toBe(true);
    expect(isMutableSchemaProvider(incomplete)).toBe(false);
    expect(isMutableSchemaProvider({} as DataProvider)).toBe(false);
  });
});

describe('isMutableDataProvider', () => {
  test('detects data mutation support', () => {
    const mutable = {
      addData: async () => {},
      updateData: async () => {},
      deleteData: async () => {}
    } as unknown as DataProvider;

    const incomplete = { addData: async () => {} } as unknown as DataProvider;

    expect(isMutableDataProvider(mutable)).toBe(true);
    expect(isMutableDataProvider(incomplete)).toBe(false);
    expect(isMutableDataProvider({} as DataProvider)).toBe(false);
  });
});
