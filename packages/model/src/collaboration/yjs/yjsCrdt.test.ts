import { describe, expect, it, vi } from 'vitest';
import { YJSFactory, YJSList, YJSMap, YJSRoot } from './yjsCrdt';
import { createSyncedYJSCRDTs } from './yjsTestUtils';

describe('wrap and unwrap', () => {
  it('should correctly wrap and unwrap primitive values', () => {
    // These functions are internal, so we'll test them indirectly through YJSMap and YJSList
    const factory = new YJSFactory();
    const map = factory.makeMap<{ str: string; num: number; bool: boolean }>();

    // Set values
    map.set('str', 'test');
    map.set('num', 123);
    map.set('bool', true);

    // Get values and verify they're the same
    expect(map.get('str')).toBe('test');
    expect(map.get('num')).toBe(123);
    expect(map.get('bool')).toBe(true);
  });
});

describe('YJSFactory', () => {
  it('should create a YJSMap', () => {
    const map = new YJSFactory().makeMap();
    expect(map).toBeInstanceOf(YJSMap);
  });

  it('should create a YJSMap with initial values', () => {
    const map = new YJSFactory().makeMap({ key: 'value' });
    expect(map.get('key')).toBe('value');
  });

  it('should create a YJSList', () => {
    const list = new YJSFactory().makeList();
    expect(list).toBeInstanceOf(YJSList);
  });

  it('should create a YJSList with initial values', () => {
    const list = new YJSFactory().makeList(['item1', 'item2']);
    expect(list.length).toBe(2);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe('item2');
  });
});

describe('YJSMap', () => {
  it('should set and get values', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');
    map.set('num', 123);
    map.set('bool', true);
    map.set('obj', { nested: 'value' });

    expect(map.get('str')).toBe('test');
    expect(map.get('num')).toBe(123);
    expect(map.get('bool')).toBe(true);
    expect(map.get('obj')).toEqual({ nested: 'value' });
  });

  it('should check if a key exists', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');

    expect(map.has('str')).toBe(true);
    expect(map.has('nonexistent')).toBe(false);
  });

  it('should delete a key', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');
    expect(map.has('str')).toBe(true);

    map.delete('str');
    expect(map.has('str')).toBe(false);
  });

  it('should clear all entries', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');
    map.set('num', 123);

    expect(map.size).toBe(2);

    map.clear();
    expect(map.size).toBe(0);
  });

  it('should return all entries', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');
    map.set('num', 123);

    const entries = Array.from(map.entries());
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual(['str', 'test']);
    expect(entries).toContainEqual(['num', 123]);
  });

  it('should return all keys', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');
    map.set('num', 123);

    const keys = Array.from(map.keys());
    expect(keys).toHaveLength(2);
    expect(keys).toContain('str');
    expect(keys).toContain('num');
  });

  it('should return all values', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');
    map.set('num', 123);

    const values = Array.from(map.values());
    expect(values).toHaveLength(2);
    expect(values).toContain('test');
    expect(values).toContain(123);
  });

  it('should clone the map', () => {
    const map = new YJSRoot().getMap('test');
    map.set('str', 'test');
    map.set('num', 123);

    const clone = map.clone();
    new YJSRoot().getMap('test').set('str', clone);
    expect(clone).not.toBe(map); // Different instance
    expect(clone.get('str')).toBe('test');
    expect(clone.get('num')).toBe(123);

    // Modifying the clone should not affect the original
    clone.set('str', 'modified');
    expect(clone.get('str')).toBe('modified');
    expect(map.get('str')).toBe('test');
  });

  it('should execute a callback in a transaction', () => {
    const map = new YJSRoot().getMap('test');

    const callback = vi.fn(() => {
      map.set('str', 'test');
    });

    map.transact(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(map.get('str')).toBe('test');
  });

  it('should emit events for remote operations', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const map1 = doc1.getMap('test');
    const map2 = doc2.getMap('test');

    const insertSpy = vi.fn();
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();

    map2.on('remoteInsert', insertSpy);
    map2.on('remoteUpdate', updateSpy);
    map2.on('remoteDelete', deleteSpy);

    // Act
    map1.set('key', 'value');

    // Verify
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'key',
        value: 'value'
      })
    );

    // Act
    map1.set('key', 'new value');

    // Verify
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'key',
        value: 'new value'
      })
    );

    // Act
    map1.delete('key');

    // Verify
    expect(deleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'key',
        value: 'new value'
      })
    );
  });
});

describe('YJSList', () => {
  it('should push and get items', () => {
    const list = new YJSRoot().getList('test');
    list.push('item1');
    list.push(123);

    expect(list.length).toBe(2);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe(123);
  });

  it('should insert items at a specific index', () => {
    const list = new YJSRoot().getList('test');
    list.push('item1');
    list.push('item3');

    list.insert(1, ['item2']);

    expect(list.length).toBe(3);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe('item2');
    expect(list.get(2)).toBe('item3');
  });

  it('should delete an item at a specific index', () => {
    const list = new YJSRoot().getList('test');
    list.push('item1');
    list.push('item2');
    list.push('item3');

    list.delete(1);

    expect(list.length).toBe(2);
    expect(list.get(0)).toBe('item1');
    expect(list.get(1)).toBe('item3');
  });

  it('should clear all items', () => {
    const list = new YJSRoot().getList('test');
    list.push('item1');
    list.push('item2');

    expect(list.length).toBe(2);

    list.clear();
    expect(list.length).toBe(0);
  });

  it('should convert to a regular array', () => {
    const list = new YJSRoot().getList('test');
    list.push('item1');
    list.push(123);

    const array = list.toArray();
    expect(array).toEqual(['item1', 123]);
  });

  it('should clone the list', () => {
    const list = new YJSRoot().getList('test');
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

  it('should execute a callback in a transaction', () => {
    const list = new YJSRoot().getList('test');
    const callback = vi.fn(() => {
      list.push('item1');
    });

    list.transact(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(list.length).toBe(1);
    expect(list.get(0)).toBe('item1');
  });

  it('should emit events for remote operations', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getList<any>('test');
    const list2 = doc2.getList<any>('test');

    // Set up event listeners
    const insertSpy = vi.fn();
    const deleteSpy = vi.fn();
    const beforeTransactionSpy = vi.fn();
    const afterTransactionSpy = vi.fn();

    list2.on('remoteInsert', insertSpy);
    list2.on('remoteDelete', deleteSpy);
    list2.on('remoteBeforeTransaction', beforeTransactionSpy);
    list2.on('remoteAfterTransaction', afterTransactionSpy);

    // Act
    list1.push('item1');

    // Verify
    expect(beforeTransactionSpy).toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 0,
        value: ['item1']
      })
    );
    expect(afterTransactionSpy).toHaveBeenCalled();

    // Act
    list1.delete(0);

    // Verify
    expect(deleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 0,
        count: 1
      })
    );
  });
});

describe('YJSRoot', () => {
  it('should create and retrieve a map', () => {
    const root = new YJSRoot();
    const map = root.getMap<{ key: string }>('testMap');
    expect(map).toBeInstanceOf(YJSMap);

    map.set('key', 'value');

    // Retrieve the same map again
    const sameMap = root.getMap<{ key: string }>('testMap');
    expect(sameMap.get('key')).toBe('value');
  });

  it('should create and retrieve a list', () => {
    const root = new YJSRoot();
    const list = root.getList<string>('testList');
    expect(list).toBeInstanceOf(YJSList);

    list.push('item1');

    // Retrieve the same list again
    const sameList = root.getList<string>('testList');
    expect(sameList.get(0)).toBe('item1');
  });

  it('should check if it has data', () => {
    const root = new YJSRoot();
    expect(root.hasData()).toBe(false);

    const map = root.getMap<{ key: string }>('testMap');
    map.set('key', 'value');

    expect(root.hasData()).toBe(true);
  });

  it('should clear all data', () => {
    const root = new YJSRoot();
    const map = root.getMap<{ key: string }>('testMap');
    map.set('key', 'value');

    expect(root.hasData()).toBe(true);

    root.clear();
    expect(root.hasData()).toBe(false);

    // The map should be empty after clearing
    expect(map.size).toBe(0);
  });

  it('should execute a callback in a transaction', () => {
    const root = new YJSRoot();
    const callback = vi.fn(() => {
      const map = root.getMap<{ key: string }>('testMap');
      map.set('key', 'value');
    });

    root.transact(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(root.getMap<{ key: string }>('testMap').get('key')).toBe('value');
  });

  it('should emit events for remote operations', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    // Create maps in the documents that we'll use with our YJSMap instances
    const map1 = doc1.getMap('testMap');
    const map2 = doc2.getMap('testMap');

    // Set up event listeners
    const insertSpy = vi.fn();
    map2.on('remoteInsert', insertSpy);

    // Perform operations on map1
    map1.set('key', 'value');

    // Verify that map2 received the events and the value was synchronized
    expect(map2.get('key')).toBe('value');
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'key',
        value: 'value'
      })
    );
  });
});
