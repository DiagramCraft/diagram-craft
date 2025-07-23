/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { watch } from '@diagram-craft/utils/watchableValue';
import { Backends } from '../../yjs/collaborationTestUtils';
import { type CRDTFactory, type CRDTMap } from '../../crdt';
import type { CRDTMapper } from './types';
import { MappedCRDTMap, type MappedCRDTMapMapType } from './mappedCrdtMap';

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

describe.each(Backends.all())('MappedCRDTMap [%s]', (_name, backend) => {
  it('should correctly initialize entries from the fromCRDT function', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    expect(Array.from(mapped1.entries)).toEqual([]);
    if (mapped2) expect(Array.from(mapped2.entries)).toEqual([]);
  });

  it('should remove items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    mapped1.add('k', 4);

    const removed = mapped1.remove('k');
    expect(removed).toBe(true);

    expect(Array.from(mapped1.entries)).toEqual([]);
    expect(Array.from(list1.get().entries())).toEqual([]);
    if (mapped2) {
      expect(Array.from(mapped2.entries)).toEqual([]);
      expect(Array.from(list2!.get().entries())).toEqual([]);
    }
  });

  it('should add items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<any>('list'));
    const list2 = doc2 ? watch(doc2.getMap<any>('list')) : undefined;

    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    mapped1.add('k', 4);

    expect(Array.from(mapped1.entries)).toEqual([['k', 4]]);
    if (mapped2) expect(Array.from(mapped2.entries)).toEqual([['k', 4]]);
  });

  it('should update wrapped items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const list2 = doc2 ? watch(doc2.getMap<MappedCRDTMapMapType<CRDTType>>('list')) : undefined;

    const mapped1 = new MappedCRDTMap<TestClass, CRDTType>(list1, testClassMapper);
    const mapped2 = list2
      ? new MappedCRDTMap<TestClass, CRDTType>(list2, testClassMapper)
      : undefined;

    const t = TestClass.fromValue(4, doc1.factory);
    mapped1.add('k', t);

    expect(Array.from(mapped1.entries).map(([, v]) => v.value)).toEqual([4]);
    if (mapped2) expect(Array.from(mapped2.entries).map(([, v]) => v.value)).toEqual([4]);

    t.value = 10;

    expect(Array.from(mapped1.entries).map(([, v]) => v.value)).toEqual([10]);
    if (mapped2) expect(Array.from(mapped2.entries).map(([, v]) => v.value)).toEqual([10]);
  });

  it('should correctly serialize to JSON', () => {
    const [doc1] = backend.syncedDocs();

    const mockList = watch(doc1.getMap<any>('list'));
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, makeMapper(doc1.factory));

    mappedList.add('a', 4);
    mappedList.add('b', 5);

    expect(mappedList.toJSON()).toEqual({
      a: 4,
      b: 5
    });
  });
});
