import { describe, expect, it } from 'vitest';
import { watch } from '@diagram-craft/utils/watchableValue';
import type { CRDTFactory, CRDTMap } from '../../crdt';
import type { CRDTMapper } from './types';
import { MappedCRDTOrderedMap, type MappedCRDTOrderedMapMapType } from './mappedCrdtOrderedMap';
import { Backends } from '../../test-support/collaborationTestUtils';

class TestClass {
  constructor(public crdt: CRDTMap<CRDTType>) {}

  get value() {
    return this.crdt.get('value')!;
  }

  set value(value: number) {
    this.crdt.set('value', value);
  }

  static fromValue(value: number, factory: CRDTFactory) {
    return new TestClass(
      factory.makeMap<CRDTType>({
        value
      })
    );
  }
}

const testClassMapper: CRDTMapper<TestClass, CRDTMap<CRDTType>> = {
  fromCRDT: (e: CRDTMap<CRDTType>) => new TestClass(e),
  toCRDT: (e: TestClass) => e.crdt
};

const makeMapper: (factory: CRDTFactory) => CRDTMapper<number, CRDTMap<CRDTType>> = factory => ({
  fromCRDT: (e: CRDTMap<CRDTType>) => e.get('value')! * 2,
  toCRDT: (e: number) =>
    factory.makeMap<CRDTType>({
      value: e / 2
    })
});

type CRDTType = { value: number };

describe.each(Backends.all())('MappedCRDTOrderedMap [%s]', (_name, backend) => {
  it('should correctly initialize entries from the fromCRDT function', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTOrderedMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    expect(mapped1.entries).toEqual([]);
    if (mapped2) expect(mapped2.entries).toEqual([]);
  });

  it('should remove items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTOrderedMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    mapped1.add('k', 4);

    const removed = mapped1.remove('k');
    expect(removed).toBe(true);

    expect(mapped1.entries).toEqual([]);
    expect(Array.from(list1.get().entries())).toEqual([]);
    if (mapped2) {
      expect(mapped2.entries).toEqual([]);
      expect(Array.from(list2!.get().entries())).toEqual([]);
    }
  });

  it('should add items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTOrderedMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    mapped1.add('k', 4);

    expect(mapped1.entries).toEqual([['k', 4]]);
    if (mapped2) expect(mapped2.entries).toEqual([['k', 4]]);
  });

  it('should update items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTOrderedMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    mapped1.add('k', 4);

    // Act
    mapped1.update('k', 5);

    // Verify
    expect(mapped1.entries).toEqual([['k', 5]]);
    if (mapped2) expect(mapped2.entries).toEqual([['k', 5]]);
  });

  it('should update wrapped items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<MappedCRDTOrderedMapMapType<CRDTType>>('list'));
    const list2 = doc2
      ? watch(doc2.getMap<MappedCRDTOrderedMapMapType<CRDTType>>('list'))
      : undefined;

    const mapped1 = new MappedCRDTOrderedMap<TestClass, CRDTType>(list1, testClassMapper);
    const mapped2 = list2
      ? new MappedCRDTOrderedMap<TestClass, CRDTType>(list2, testClassMapper)
      : undefined;

    const t = TestClass.fromValue(4, doc1.factory);
    mapped1.add('k', t);

    expect(mapped1.entries.map(([, v]) => v.value)).toEqual([4]);
    if (mapped2) expect(mapped2.entries.map(([, v]) => v.value)).toEqual([4]);

    t.value = 10;

    expect(mapped1.entries.map(([, v]) => v.value)).toEqual([10]);
    if (mapped2) expect(mapped2.entries.map(([, v]) => v.value)).toEqual([10]);
  });

  it('should correctly serialize to JSON', () => {
    const [doc1] = backend.syncedDocs();

    const mockList = watch(doc1.getMap<any>('test'));
    const mappedList = new MappedCRDTOrderedMap<number, CRDTType>(
      mockList,
      makeMapper(doc1.factory)
    );

    mappedList.add('a', 4);
    mappedList.add('b', 5);

    expect(mappedList.toJSON()).toEqual({
      a: 4,
      b: 5
    });
  });

  it('should insert items at the correct position', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTOrderedMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    mapped1.add('a', 2);
    mapped1.add('b', 4);
    mapped1.add('c', 6);

    // Insert at beginning (position 0)
    mapped1.insert('d', 0, 0);
    expect(mapped1.entries).toEqual([
      ['d', 0],
      ['a', 2],
      ['b', 4],
      ['c', 6]
    ]);
    if (mapped2)
      expect(mapped2.entries).toEqual([
        ['d', 0],
        ['a', 2],
        ['b', 4],
        ['c', 6]
      ]);

    // Insert in middle (position 2)
    mapped1.insert('e', 5, 2);
    expect(mapped1.entries).toEqual([
      ['d', 0],
      ['a', 2],
      ['e', 5],
      ['b', 4],
      ['c', 6]
    ]);
    if (mapped2)
      expect(mapped2.entries).toEqual([
        ['d', 0],
        ['a', 2],
        ['e', 5],
        ['b', 4],
        ['c', 6]
      ]);

    // Insert at end (position 5, after 5 elements)
    mapped1.insert('f', 8, 5);
    expect(mapped1.entries).toEqual([
      ['d', 0],
      ['a', 2],
      ['e', 5],
      ['b', 4],
      ['c', 6],
      ['f', 8]
    ]);
    if (mapped2)
      expect(mapped2.entries).toEqual([
        ['d', 0],
        ['a', 2],
        ['e', 5],
        ['b', 4],
        ['c', 6],
        ['f', 8]
      ]);
  });

  it('should behave identically to add when inserting at the end', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list1'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list2')) : undefined;

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTOrderedMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    // Build one list using add
    mapped1.add('a', 2);
    mapped1.add('b', 4);
    mapped1.add('c', 6);

    // Build another list using insert at end position (0-based indices)
    if (mapped2) {
      mapped2.insert('a', 2, 0); // Insert at position 0 (first position)
      mapped2.insert('b', 4, 1); // Insert at position 1 (second position)
      mapped2.insert('c', 6, 2); // Insert at position 2 (third position)

      // Both should have identical structure
      expect(mapped2.entries).toEqual(mapped1.entries);
      expect(mapped2.getIndex('a')).toEqual(mapped1.getIndex('a'));
      expect(mapped2.getIndex('b')).toEqual(mapped1.getIndex('b'));
      expect(mapped2.getIndex('c')).toEqual(mapped1.getIndex('c'));
    }
  });

  it('should insert correctly when using array size', () => {
    const [doc1] = backend.syncedDocs();
    const list1 = watch(doc1.getMap<any>('list1'));
    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, makeMapper(doc1.factory));

    mapped1.insert('a1', 1, mapped1.size);
    mapped1.insert('a2', 1, mapped1.size);
    mapped1.insert('a', 1, mapped1.size);
    mapped1.remove('a1');
    mapped1.remove('a2');
    mapped1.insert('b', 2, mapped1.size);
    mapped1.insert('c', 3, mapped1.size);

    expect(mapped1.entries).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ]);
  });
});
