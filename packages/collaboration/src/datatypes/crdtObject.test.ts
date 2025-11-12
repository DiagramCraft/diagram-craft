import { describe, expect, it, vi } from 'vitest';
import { type CRDTMap } from '../crdt';
import { NoOpCRDTMap } from '../noopCrdt';
import { CRDTObject } from './crdtObject';
import { watch } from '@diagram-craft/utils/watchableValue';

type TestObject = {
  name?: string;
  age?: number;
  address?: { street: string; city: string };
  people?: Array<{ firstName: string; lastName: string; hobbies?: string[] }>;
};

describe('CRDTObject', () => {
  it('should get proxy values correctly', () => {
    const map = new NoOpCRDTMap();
    const onChange = vi.fn();

    const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), onChange);

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
    const map = new NoOpCRDTMap();
    const onChange = vi.fn();

    const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), onChange);

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
    const map = new NoOpCRDTMap();
    const onChange = vi.fn();

    const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), onChange);

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

  it('should support arrays in the object structure', () => {
    const map = new NoOpCRDTMap();
    const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

    // Set array values using dot notation
    map.set('people.0.firstName', 'John');
    map.set('people.0.lastName', 'Doe');
    map.set('people.1.firstName', 'Jane');
    map.set('people.1.lastName', 'Smith');

    // Verify array access through proxy
    const proxy = obj.get();
    expect(proxy.people![0]!.firstName).toBe('John');
    expect(proxy.people![0]!.lastName).toBe('Doe');
    expect(proxy.people![1]!.firstName).toBe('Jane');
    expect(proxy.people![1]!.lastName).toBe('Smith');

    // Verify array structure in clone
    const clone = obj.getClone();
    expect(Array.isArray(clone.people)).toBe(true);
    expect(clone.people?.length).toBe(2);
    expect(clone.people).toEqual([
      { firstName: 'John', lastName: 'Doe' },
      { firstName: 'Jane', lastName: 'Smith' }
    ]);
  });

  it('should support updating arrays using the update method', () => {
    const map = new NoOpCRDTMap();
    const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

    // Update with array data
    obj.update(p => {
      p.people = [
        { firstName: 'Alice', lastName: 'Johnson' },
        { firstName: 'Bob', lastName: 'Williams' }
      ];
    });

    // Verify people is an array
    expect(Array.isArray(obj.get().people)).toBe(true);

    // Verify the map contains the correct flattened structure
    expect(map.get('people.0.firstName')).toBe('Alice');
    expect(map.get('people.0.lastName')).toBe('Johnson');
    expect(map.get('people.1.firstName')).toBe('Bob');
    expect(map.get('people.1.lastName')).toBe('Williams');

    // Verify iteration works
    let count = 0;
    for (const p of obj.get().people!) {
      expect(p).toBeDefined();
      count++;
    }
    expect(count).toBe(2);

    // Verify the clone reconstructs the array correctly
    const clone = obj.getClone();
    expect(Array.isArray(clone.people)).toBe(true);
    expect(clone.people?.length).toBe(2);
  });

  it('should handle array modifications correctly', () => {
    const map = new NoOpCRDTMap();
    const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

    // Initialize with array data
    obj.update(p => {
      p.people = [
        { firstName: 'Alice', lastName: 'Johnson' },
        { firstName: 'Bob', lastName: 'Williams' }
      ];
    });

    // Modify array elements
    obj.update(p => {
      if (p.people) {
        p.people[0]!.firstName = 'Alicia';
        p.people[1] = { firstName: 'Robert', lastName: 'Wilson' };
      }
    });

    // Verify modifications
    const clone = obj.getClone();
    expect(clone.people![0]!.firstName).toBe('Alicia');
    expect(clone.people![1]!.firstName).toBe('Robert');
    expect(clone.people![1]!.lastName).toBe('Wilson');
  });

  describe('getClone', () => {
    it('should return an identical deep copy of the object', () => {
      const map = new NoOpCRDTMap();
      const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

      // Populate map with values
      map.set('name', 'John');
      map.set('age', 30);
      map.set('address.street', '123 Main St');
      map.set('address.city', 'Springfield');

      const clone = obj.getClone();

      // Verify the cloned object matches the current state
      expect(clone).toEqual({
        name: 'John',
        age: 30,
        address: {
          street: '123 Main St',
          city: 'Springfield'
        }
      });
    });

    it('should ensure nested structures are cloned independently', () => {
      const map = new NoOpCRDTMap();
      const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

      map.set('address.street', '456 Oak Ave');
      map.set('address.city', 'Denver');

      const clone = obj.getClone();

      // Verify structure is accurate
      expect(clone.address).toEqual({
        street: '456 Oak Ave',
        city: 'Denver'
      });

      // Check deep independence
      // @ts-ignore
      clone.address!.street = 'Modified St';
      expect(clone.address!.street).toBe('Modified St');
      expect(obj.get().address?.street).toBe('456 Oak Ave');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize and deserialize a CRDTObject directly', () => {
      const map = new NoOpCRDTMap();
      const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

      // Create a complex object with nested structures and arrays
      obj.update(p => {
        p.name = 'John Doe';
        p.age = 35;
        p.address = {
          street: '123 Main St',
          city: 'New York'
        };
        p.people = [
          {
            firstName: 'Alice',
            lastName: 'Smith',
            hobbies: ['reading', 'cycling']
          },
          {
            firstName: 'Bob',
            lastName: 'Johnson',
            hobbies: ['cooking', 'gaming', 'hiking']
          }
        ];
      });

      // Serialize to JSON directly without calling getClone
      const json = JSON.stringify(obj);

      // Verify JSON string is valid
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      // Parse JSON back to object
      const parsed = JSON.parse(json);

      // Verify parsed object matches original structure
      expect(parsed).toEqual({
        name: 'John Doe',
        age: 35,
        address: {
          street: '123 Main St',
          city: 'New York'
        },
        people: [
          {
            firstName: 'Alice',
            lastName: 'Smith',
            hobbies: ['reading', 'cycling']
          },
          {
            firstName: 'Bob',
            lastName: 'Johnson',
            hobbies: ['cooking', 'gaming', 'hiking']
          }
        ]
      });

      // Verify nested arrays are preserved correctly
      expect(Array.isArray(parsed.people)).toBe(true);
      expect(Array.isArray(parsed.people[0].hobbies)).toBe(true);
      expect(parsed.people[0].hobbies.length).toBe(2);
      expect(parsed.people[1].hobbies.length).toBe(3);
    });

    it('should serialize an empty CRDTObject', () => {
      const map = new NoOpCRDTMap();
      const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual({});
    });

    it('should handle undefined values during serialization', () => {
      const map = new NoOpCRDTMap();
      const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

      obj.update(p => {
        p.name = 'Jane';
        p.age = undefined;
        p.address = {
          street: '456 Oak Ave',
          city: 'Boston'
        };
      });

      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);

      // Note: JSON.stringify omits undefined values
      expect(parsed.name).toBe('Jane');
      expect(parsed.age).toBeUndefined();
      expect(parsed.address).toEqual({
        street: '456 Oak Ave',
        city: 'Boston'
      });
    });
  });

  describe('set method with nested property deletion', () => {
    it('should properly delete nested properties when using set method', () => {
      const map = new NoOpCRDTMap();
      const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

      // Initially set indicators with multiple properties
      const initialIndicators = {
        indicator1: { enabled: true, color: 'red' },
        indicator2: { enabled: false, color: 'blue' },
        indicator3: { enabled: true, color: 'green' }
      };

      obj.set(initialIndicators as TestObject);

      // Verify all indicators are set
      expect(map.get('indicator1.enabled')).toBe(true);
      expect(map.get('indicator1.color')).toBe('red');
      expect(map.get('indicator2.enabled')).toBe(false);
      expect(map.get('indicator2.color')).toBe('blue');
      expect(map.get('indicator3.enabled')).toBe(true);
      expect(map.get('indicator3.color')).toBe('green');

      // Now remove indicator2 by creating a copy and deleting it (simulating NamedIndicatorPanel behavior)
      const newIndicators = { ...initialIndicators };
      delete (newIndicators as any).indicator2;
      obj.set(newIndicators as TestObject);

      // Verify indicator2 is completely removed from the CRDT
      expect(map.get('indicator1.enabled')).toBe(true);
      expect(map.get('indicator1.color')).toBe('red');
      expect(map.get('indicator2.enabled')).toBeUndefined();
      expect(map.get('indicator2.color')).toBeUndefined();
      expect(map.get('indicator3.enabled')).toBe(true);
      expect(map.get('indicator3.color')).toBe('green');

      // Verify the proxy object also reflects the deletion
      const proxy = obj.get();
      expect((proxy as any).indicator1).toBeDefined();
      expect((proxy as any).indicator2).toBeUndefined();
      expect((proxy as any).indicator3).toBeDefined();
    });

    it('should handle deletion of multiple nested properties at different levels', () => {
      const map = new NoOpCRDTMap();
      const obj = new CRDTObject<TestObject>(watch<CRDTMap>(map), vi.fn());

      // Set up a complex nested structure
      const initialData = {
        user: {
          profile: { name: 'John', age: 30 },
          settings: { theme: 'dark', notifications: true }
        },
        indicators: {
          warning: { enabled: true, count: 5 },
          error: { enabled: false, count: 0 },
          info: { enabled: true, count: 10 }
        }
      };

      obj.set(initialData as TestObject);

      // Verify initial structure
      expect(map.get('user.profile.name')).toBe('John');
      expect(map.get('user.settings.theme')).toBe('dark');
      expect(map.get('indicators.warning.enabled')).toBe(true);
      expect(map.get('indicators.error.count')).toBe(0);

      // Modify by removing user.settings and indicators.error
      const modifiedData = {
        user: {
          profile: { name: 'John', age: 30 }
          // settings removed
        },
        indicators: {
          warning: { enabled: true, count: 5 },
          // error removed
          info: { enabled: true, count: 10 }
        }
      };

      obj.set(modifiedData as TestObject);

      // Verify deletions occurred properly
      expect(map.get('user.profile.name')).toBe('John');
      expect(map.get('user.profile.age')).toBe(30);
      expect(map.get('user.settings.theme')).toBeUndefined();
      expect(map.get('user.settings.notifications')).toBeUndefined();
      expect(map.get('indicators.warning.enabled')).toBe(true);
      expect(map.get('indicators.error.enabled')).toBeUndefined();
      expect(map.get('indicators.error.count')).toBeUndefined();
      expect(map.get('indicators.info.enabled')).toBe(true);

      // Verify structure in the proxy
      const proxy = obj.get();
      expect((proxy as any).user.profile.name).toBe('John');
      expect((proxy as any).user.settings).toBeUndefined();
      expect((proxy as any).indicators.warning).toBeDefined();
      expect((proxy as any).indicators.error).toBeUndefined();
      expect((proxy as any).indicators.info).toBeDefined();
    });
  });
});
