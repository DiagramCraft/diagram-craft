import { describe, test, expect } from 'vitest';
import { fromFlatObjectMap, FlatObjectMapProxy } from './flatObject';
import { DynamicValue } from './dynamicValue';

describe('fromFlatObjectMap', () => {
  test('converts simple nested object', () => {
    const map = new Map<string, string | number>([
      ['user.name', 'John'],
      ['user.age', 30]
    ]);

    const result = fromFlatObjectMap(map);

    expect(result).toEqual({
      user: {
        name: 'John',
        age: 30
      }
    });
  });

  test('converts deeply nested object', () => {
    const map = new Map([
      ['user.name', 'John'],
      ['user.address.city', 'NYC'],
      ['user.address.zip', '10001']
    ]);

    const result = fromFlatObjectMap(map);

    expect(result).toEqual({
      user: {
        name: 'John',
        address: {
          city: 'NYC',
          zip: '10001'
        }
      }
    });
  });

  test('converts array structure', () => {
    const map = new Map([
      ['items.0', 'first'],
      ['items.1', 'second'],
      ['items.2', 'third']
    ]);

    const result = fromFlatObjectMap<{ items: string[] }>(map);

    expect(result).toEqual({
      items: ['first', 'second', 'third']
    });
  });

  test('converts mixed object and array structure', () => {
    const map = new Map([
      ['user.name', 'John'],
      ['user.tags.0', 'admin'],
      ['user.tags.1', 'user']
    ]);

    const result = fromFlatObjectMap(map);

    expect(result).toEqual({
      user: {
        name: 'John',
        tags: ['admin', 'user']
      }
    });
  });

  test('handles empty map', () => {
    const map = new Map();
    const result = fromFlatObjectMap(map);
    expect(result).toEqual({});
  });

  test('handles undefined values as empty objects', () => {
    const map = new Map([
      ['user.name', 'John'],
      ['user.settings', undefined]
    ]);

    const result = fromFlatObjectMap(map);

    expect(result).toEqual({
      user: {
        name: 'John',
        settings: {}
      }
    });
  });
});

describe('FlatObjectMapProxy', () => {
  describe('reading values', () => {
    test('reads nested property', () => {
      const map = new Map([['user.name', 'John']]);
      const proxy = FlatObjectMapProxy.create<{ user: { name: string } }>(DynamicValue.of(map));

      expect(proxy.user.name).toBe('John');
    });

    test('reads deeply nested property', () => {
      const map = new Map([['user.address.city', 'NYC']]);
      const proxy = FlatObjectMapProxy.create<{
        user: { address: { city: string } };
      }>(DynamicValue.of(map));

      expect(proxy.user.address.city).toBe('NYC');
    });

    test('reads array-like structure', () => {
      const map = new Map([
        ['items.0', 'first'],
        ['items.1', 'second']
      ]);
      const proxy = FlatObjectMapProxy.create<{ items: string[] }>(DynamicValue.of(map));

      // Arrays are returned as proxies, so we access via the proxy
      const items = proxy.items;
      expect(items).toBeDefined();
      expect(items.length).toBe(2);
    });

    test('returns undefined for non-existent property', () => {
      const map = new Map();
      const proxy = FlatObjectMapProxy.create<{ user?: { name?: string } }>(DynamicValue.of(map));

      expect(proxy.user).toBeUndefined();
    });

    test('calculates array length', () => {
      const map = new Map([
        ['items.0', 'a'],
        ['items.1', 'b'],
        ['items.2', 'c']
      ]);
      const proxy = FlatObjectMapProxy.create<{ items: string[] }>(DynamicValue.of(map));

      expect(proxy.items.length).toBe(3);
    });
  });

  describe('writing values', () => {
    test('writes nested object', () => {
      const map = new Map();
      const proxy = FlatObjectMapProxy.create<{ user: { name: string } }>(DynamicValue.of(map));

      proxy.user = { name: 'John' };

      expect(map.get('user.name')).toBe('John');
    });

    test('writes deeply nested object', () => {
      const map = new Map();
      const proxy = FlatObjectMapProxy.create<{
        user: { address: { city: string } };
      }>(DynamicValue.of(map));

      proxy.user = { address: { city: 'NYC' } };

      expect(map.get('user.address.city')).toBe('NYC');
    });

    test('writes property on existing object', () => {
      const map = new Map([['user.name', 'John']]);
      const proxy = FlatObjectMapProxy.create<{ user: { name: string; age?: number } }>(
        DynamicValue.of(map)
      );

      proxy.user.age = 30;

      expect(map.get('user.age')).toBe(30);
      expect(map.get('user.name')).toBe('John');
    });

    test('overwrites existing property', () => {
      const map = new Map([['user.name', 'John']]);
      const proxy = FlatObjectMapProxy.create<{ user: { name: string } }>(DynamicValue.of(map));

      proxy.user.name = 'Jane';

      expect(map.get('user.name')).toBe('Jane');
    });

    test('writes nested object as multiple keys', () => {
      const map = new Map();
      const proxy = FlatObjectMapProxy.create<{
        user: { name: string; age: number };
      }>(DynamicValue.of(map));

      proxy.user = { name: 'John', age: 30 };

      expect(map.get('user.name')).toBe('John');
      expect(map.get('user.age')).toBe(30);
    });

    test('deletes property when set to undefined', () => {
      const map = new Map<string, string | number>([
        ['user.name', 'John'],
        ['user.age', 30]
      ]);
      const proxy = FlatObjectMapProxy.create<{
        user: { name?: string; age?: number };
      }>(DynamicValue.of(map));

      proxy.user.name = undefined;

      expect(map.has('user.name')).toBe(false);
      expect(map.get('user.age')).toBe(30);
    });

    test('deletes nested properties when parent set to undefined', () => {
      const map = new Map([
        ['user.name', 'John'],
        ['user.address.city', 'NYC'],
        ['user.address.zip', '10001']
      ]);
      const proxy = FlatObjectMapProxy.create<{
        user?: { name: string; address: { city: string; zip: string } };
      }>(DynamicValue.of(map));

      proxy.user = undefined;

      expect(map.has('user.name')).toBe(false);
      expect(map.has('user.address.city')).toBe(false);
      expect(map.has('user.address.zip')).toBe(false);
    });
  });

  describe('enumeration', () => {
    test('enumerates top-level keys', () => {
      const map = new Map<string, string | number>([
        ['user.name', 'John'],
        ['user.age', 30],
        ['settings.theme', 'dark']
      ]);
      const proxy = FlatObjectMapProxy.create<{
        user: { name: string; age: number };
        settings: { theme: string };
      }>(DynamicValue.of(map));

      const keys = Object.keys(proxy);

      expect(keys).toContain('user');
      expect(keys).toContain('settings');
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    test('enumerates nested keys', () => {
      const map = new Map<string, string | number>([
        ['user.name', 'John'],
        ['user.age', 30]
      ]);
      const proxy = FlatObjectMapProxy.create<{
        user: { name: string; age: number };
      }>(DynamicValue.of(map));

      const keys = Object.keys(proxy.user);

      expect(keys).toContain('name');
      expect(keys).toContain('age');
    });
  });

  describe('toJSON', () => {
    test('converts proxy to nested object via toJSON', () => {
      const map = new Map<string, string | number>([
        ['user.name', 'John'],
        ['user.age', 30]
      ]);
      const proxy = FlatObjectMapProxy.create<{
        user: { name: string; age: number };
      }>(DynamicValue.of(map));

      const json = JSON.parse(JSON.stringify(proxy));

      expect(json).toEqual({
        user: {
          name: 'John',
          age: 30
        }
      });
    });
  });
});
