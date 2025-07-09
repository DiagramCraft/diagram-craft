import { describe, expect, it, vi } from 'vitest';
import { CRDT, CRDTMap, CRDTObject, Flatten } from './crdt';
import { NoOpCRDTMap } from './noopCrdt';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';

type TestType = { value: string };

describe('CRDT', () => {
  describe('makeProp', () => {
    it('should get and set values correctly', () => {
      const map = new WatchableValue<CRDTMap<TestType>>(new NoOpCRDTMap<TestType>());
      const prop = CRDT.makeProp('value', map);

      prop.set('test');
      expect(prop.get()).toBe('test');
      expect(map.get().get('value')).toBe('test');
    });

    it('should call onChange when value is updated locally', () => {
      const map = new WatchableValue<CRDTMap<TestType>>(new NoOpCRDTMap<TestType>());
      const onChange = vi.fn();
      const prop = CRDT.makeProp('value', map, onChange);
      prop.set('test');

      prop.set('new value');
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});

type TestObject = { name?: string; age?: number; address?: { street: string; city: string } };
type FlatTestObject = Flatten<TestObject>;

describe('CRDTObject', () => {
  it('should initialize correctly and trigger onChange for remote/local transactions', () => {
    const map = new NoOpCRDTMap<FlatTestObject>();
    const onChange = vi.fn();

    const obj = new CRDTObject<TestObject>(map, onChange);

    // Verify proxy initialization
    expect(obj.get()).toEqual({});

    // Simulate a transaction
    map.transact(() => map.set('name', 'John'));
    expect(onChange).toHaveBeenCalledTimes(1);

    // Simulate another transaction
    map.transact(() => map.set('age', 30));
    expect(onChange).toHaveBeenCalledTimes(2);

    // Set nested object properties
    map.transact(() => {
      map.set('address.street', '123 Main St');
      map.set('address.city', 'Springfield');
    });
    expect(onChange).toHaveBeenCalledTimes(3);

    expect(obj.get()).toEqual({
      age: 30,
      name: 'John',
      address: {
        street: '123 Main St',
        city: 'Springfield'
      }
    });
  });

  it('should get proxy values correctly', () => {
    const map = new NoOpCRDTMap<FlatTestObject>();
    const onChange = vi.fn();

    const obj = new CRDTObject<TestObject>(map, onChange);

    // Set values on map including nested object
    map.set('name', 'Jane');
    map.set('age', 25);
    map.set('address.street', '456 Oak Ave');
    map.set('address.city', 'Denver');

    // Verify values through proxy
    const proxy = obj.get();
    expect(proxy.name).toBe('Jane');
    expect(proxy.age).toBe(25);
    expect(proxy.address?.street).toBe('456 Oak Ave');
    expect(proxy.address?.city).toBe('Denver');
  });

  it('should update values using the update method', () => {
    const map = new NoOpCRDTMap<FlatTestObject>();
    const onChange = vi.fn();

    const obj = new CRDTObject<TestObject>(map, onChange);

    // Use update to modify data including nested object
    obj.update(p => {
      p.name = 'Alice';
      p.age = 40;

      p.address = {
        street: '789 Pine St',
        city: 'Seattle'
      };
    });

    // Verify updates including nested object
    expect(map.get('name')).toBe('Alice');
    expect(map.get('age')).toBe(40);
    expect(map.get('address.street')).toBe('789 Pine St');
    expect(map.get('address.city')).toBe('Seattle');
  });

  it('should delete values via proxy set to undefined', () => {
    const map = new NoOpCRDTMap<FlatTestObject>();
    const onChange = vi.fn();

    const obj = new CRDTObject<TestObject>(map, onChange);

    // Initially set some values including nested object
    obj.update(p => {
      p.name = 'Bob';
      p.age = 35;
      p.address = {
        street: '321 Elm St',
        city: 'Portland'
      };
    });

    // Set values to undefined to trigger deletes
    obj.update(p => {
      p.name = undefined;
      p.address = undefined;
    });

    // Verify deletion including nested object
    expect(map.get('name')).toBeUndefined();
    expect(map.get('address.street')).toBeUndefined();
    expect(map.get('address.city')).toBeUndefined();
    expect(map.get('age')).toBe(35);
  });
});
