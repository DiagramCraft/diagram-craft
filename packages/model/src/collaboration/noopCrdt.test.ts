import { describe, expect, it, vi } from 'vitest';
import { NoOpCRDTFactory, NoOpCRDTList, NoOpCRDTMap, NoOpCRDTRoot } from './noopCrdt';

describe('NoOpCRDTFactory', () => {
  it('should create a NoOpCRDTMap', () => {
    const map = new NoOpCRDTFactory().makeMap();
    expect(map).toBeInstanceOf(NoOpCRDTMap);
  });

  it('should create a NoOpCRDTMap with initial values', () => {
    const map = new NoOpCRDTFactory().makeMap({ key: 'value' });
    expect(map.get('key')).toBe('value');
  });

  it('should create a NoOpCRDTList', () => {
    const list = new NoOpCRDTFactory().makeList();
    expect(list).toBeInstanceOf(NoOpCRDTList);
  });

  it('should create a NoOpCRDTList with initial values', () => {
    const list = new NoOpCRDTFactory().makeList(['item1', 'item2']);
    expect(list.length).toBe(2);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe('item2');
  });
});

describe('NoOpCRDTMap', () => {
  it('should initialize with empty map when no initial values are provided', () => {
    const map = new NoOpCRDTMap();
    expect(map.size).toBe(0);
  });

  it('should initialize with provided values', () => {
    const initialMap = new NoOpCRDTMap({ key1: 'value1', key2: 42 });
    expect(initialMap.size).toBe(2);
    expect(initialMap.get('key1')).toBe('value1');
    expect(initialMap.get('key2')).toBe(42);
  });

  it('should set and get values', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');
    map.set('num', 123);
    map.set('bool', true);
    map.set('obj', { nested: 'value' });

    expect(map.get('str')).toBe('test');
    expect(map.get('num')).toBe(123);
    expect(map.get('bool')).toBe(true);
    expect(map.get('obj')).toEqual({ nested: 'value' });
  });

  it('should use factory function when key does not exist', () => {
    const map = new NoOpCRDTMap();
    const value = map.get('str', () => 'default');
    expect(value).toBe('default');
    expect(map.has('str')).toBe(true);
  });

  it('should check if a key exists', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');

    expect(map.has('str')).toBe(true);
    expect(map.has('nonexistent')).toBe(false);
  });

  it('should delete a key', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');
    expect(map.has('str')).toBe(true);

    map.delete('str');
    expect(map.has('str')).toBe(false);
  });

  it('should clear all entries', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');
    map.set('num', 123);

    expect(map.size).toBe(2);

    map.clear();
    expect(map.size).toBe(0);
  });

  it('should return all entries', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');
    map.set('num', 123);

    const entries = Array.from(map.entries());
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual(['str', 'test']);
    expect(entries).toContainEqual(['num', 123]);
  });

  it('should return all keys', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');
    map.set('num', 123);

    const keys = Array.from(map.keys());
    expect(keys).toHaveLength(2);
    expect(keys).toContain('str');
    expect(keys).toContain('num');
  });

  it('should return all values', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');
    map.set('num', 123);

    const values = Array.from(map.values());
    expect(values).toHaveLength(2);
    expect(values).toContain('test');
    expect(values).toContain(123);
  });

  it('should clone the map', () => {
    const map = new NoOpCRDTMap();
    map.set('str', 'test');
    map.set('num', 123);

    const clone = map.clone();
    expect(clone).not.toBe(map); // Different instance
    expect(clone.get('str')).toBe('test');
    expect(clone.get('num')).toBe(123);

    // Modifying the clone should not affect the original
    clone.set('str', 'modified');
    expect(clone.get('str')).toBe('modified');
    expect(map.get('str')).toBe('test');
  });

  it('should clone nested maps and lists', () => {
    const map = new NoOpCRDTMap();
    const factory = new NoOpCRDTFactory();
    const nestedMap = factory.makeMap<{ value: string }>();
    nestedMap.set('value', 'nested value');

    const nestedList = factory.makeList<string>();
    nestedList.push('item1');

    map.set('map', nestedMap);
    map.set('list', nestedList);

    const clone = map.clone();

    // Check that nested structures are cloned, not referenced
    expect(clone.get('map')).not.toBe(nestedMap);
    expect(clone.get('list')).not.toBe(nestedList);

    // Check that nested values are preserved
    expect(clone.get('map')?.get('value')).toBe('nested value');
    expect(clone.get('list')?.get(0)).toBe('item1');
  });

  it('should execute a callback in a transaction', () => {
    const map = new NoOpCRDTMap();
    const callback = vi.fn(() => {
      map.set('str', 'test');
    });

    map.transact(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(map.get('str')).toBe('test');
  });
});

describe('NoOpCRDTList', () => {
  it('should initialize with empty list', () => {
    const list = new NoOpCRDTList();
    expect(list.length).toBe(0);
  });

  it('should push and get items', () => {
    const list = new NoOpCRDTList();
    list.push('item1');
    list.push(123);

    expect(list.length).toBe(2);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe(123);
  });

  it('should insert items at a specific index', () => {
    const list = new NoOpCRDTList();
    list.push('item1');
    list.push('item3');

    list.insert(1, ['item2']);

    expect(list.length).toBe(3);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe('item2');
    expect(list.get(2)).toBe('item3');
  });

  it('should delete an item at a specific index', () => {
    const list = new NoOpCRDTList();
    list.push('item1');
    list.push('item2');
    list.push('item3');

    list.delete(1);

    expect(list.length).toBe(2);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe('item3');
  });

  it('should clear all items', () => {
    const list = new NoOpCRDTList();
    list.push('item1');
    list.push('item2');

    expect(list.length).toBe(2);

    list.clear();
    expect(list.length).toBe(0);
  });

  it('should convert to a regular array', () => {
    const list = new NoOpCRDTList();
    list.push('item1');
    list.push(123);

    const array = list.toArray();
    expect(array).toEqual(['item1', 123]);
  });

  it('should clone the list', () => {
    const list = new NoOpCRDTList();
    list.push('item1');
    list.push(123);

    const clone = list.clone();
    expect(clone).not.toBe(list); // Different instance
    expect(clone.length).toBe(2);
    expect(clone.get(0)).toBe('item1');
    expect(clone.get(1)).toBe(123);

    // Modifying the clone should not affect the original
    clone.push('item3');
    expect(clone.length).toBe(3);
    expect(list.length).toBe(2);
  });

  it('should clone nested maps and lists', () => {
    const list = new NoOpCRDTList();
    const factory = new NoOpCRDTFactory();
    const nestedMap = factory.makeMap<{ value: string }>();
    nestedMap.set('value', 'nested value');

    const nestedList = factory.makeList<string>();
    nestedList.push('item1');

    list.push(nestedMap as unknown as string | number);
    list.push(nestedList as unknown as string | number);

    const clone = list.clone();

    // Check that nested structures are cloned, not referenced
    expect(clone.get(0)).not.toBe(nestedMap);
    expect(clone.get(1)).not.toBe(nestedList);

    // Check that nested values are preserved
    expect((clone.get(0) as unknown as NoOpCRDTMap<{ value: string }>).get('value')).toBe(
      'nested value'
    );
    expect((clone.get(1) as unknown as NoOpCRDTList<string>).get(0)).toBe('item1');
  });

  it('should execute a callback in a transaction', () => {
    const list = new NoOpCRDTList();
    const callback = vi.fn(() => {
      list.push('item1');
    });

    list.transact(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(list.length).toBe(1);
    expect(list.get(0)).toBe('item1');
  });
});

describe('NoOpCRDTRoot', () => {
  it('should initialize with no data', () => {
    const root = new NoOpCRDTRoot();
    expect(root.hasData()).toBe(false);
  });

  it('should create and retrieve a map', () => {
    const root = new NoOpCRDTRoot();
    const map = root.getMap<{ key: string }>('testMap');
    expect(map).toBeInstanceOf(NoOpCRDTMap);

    map.set('key', 'value');

    // Retrieve the same map again
    const sameMap = root.getMap<{ key: string }>('testMap');
    expect(sameMap.get('key')).toBe('value');
  });

  it('should create and retrieve a list', () => {
    const root = new NoOpCRDTRoot();
    const list = root.getList<string>('testList');
    expect(list).toBeInstanceOf(NoOpCRDTList);

    list.push('item1');

    // Retrieve the same list again
    const sameList = root.getList<string>('testList');
    expect(sameList.get(0)).toBe('item1');
  });

  it('should check if it has data', () => {
    const root = new NoOpCRDTRoot();
    expect(root.hasData()).toBe(false);

    const map = root.getMap<{ key: string }>('testMap');
    map.set('key', 'value');

    expect(root.hasData()).toBe(true);
  });

  it('should clear all data', () => {
    const root = new NoOpCRDTRoot();
    const map = root.getMap<{ key: string }>('testMap');
    map.set('key', 'value');

    const list = root.getList<string>('testList');
    list.push('item1');

    expect(root.hasData()).toBe(true);

    root.clear();
    expect(root.hasData()).toBe(false);

    // After clearing, the original map and list instances still exist,
    // but new instances will be created when getMap/getList are called again
    const newMap = root.getMap<{ key: string }>('testMap');
    const newList = root.getList<string>('testList');

    expect(newMap.size).toBe(0);
    expect(newList.length).toBe(0);
  });

  it('should execute a callback in a transaction', () => {
    const root = new NoOpCRDTRoot();
    const callback = vi.fn(() => {
      const map = root.getMap<{ key: string }>('testMap');
      map.set('key', 'value');
    });

    root.transact(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(root.getMap<{ key: string }>('testMap').get('key')).toBe('value');
  });
});
