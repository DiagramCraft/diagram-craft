/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { MappedCRDTOrderedMap, MappedCRDTOrderedMapMapType } from '../mappedCRDTOrderedMap';
import { CRDT, CRDTMap } from '../crdt';

class TestClass {
  constructor(public crdt: CRDTMap<CRDTType>) {}

  get value() {
    return this.crdt.get('value')!;
  }

  static fromValue(value: number) {
    const map = new CRDT.Map();
    map.set('value', value);
    return new TestClass(map);
  }
}

const fromCRDTTestClass = (e: CRDTMap<CRDTType>): TestClass => {
  return new TestClass(e);
};

const toCRDTTestClass = (e: TestClass): CRDTMap<CRDTType> => {
  return e.crdt;
};

const fromCRDT = (e: CRDTMap<CRDTType>): number => {
  return e.get('value')! * 2;
};
const toCRDT = (e: number): CRDTMap<CRDTType> => {
  const map = new CRDT.Map();
  map.set('value', e / 2);
  return map;
};

type CRDTType = { value: number };

describe('YJS MappedCRDTOrderedMap', () => {
  setupYJS();

  it('should correctly initialize entries from the fromCRDT function', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<any>('list');
    const list2 = doc2.getMap<any>('list');

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, fromCRDT, toCRDT);
    const mapped2 = new MappedCRDTOrderedMap<number, CRDTType>(list2, fromCRDT, toCRDT);

    expect(mapped1.entries).toEqual([]);
    expect(mapped2.entries).toEqual([]);
  });

  it('should remove items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<any>('list');
    const list2 = doc2.getMap<any>('list');

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, fromCRDT, toCRDT);
    const mapped2 = new MappedCRDTOrderedMap<number, CRDTType>(list2, fromCRDT, toCRDT);

    mapped1.add('k', 4);

    const removed = mapped1.remove('k');
    expect(removed).toBe(true);

    expect(mapped1.entries).toEqual([]);
    expect(Array.from(list1.entries())).toEqual([]);
    expect(mapped2.entries).toEqual([]);
    expect(Array.from(list2.entries())).toEqual([]);
  });

  it('should add items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<any>('list');
    const list2 = doc2.getMap<any>('list');

    const mapped1 = new MappedCRDTOrderedMap<number, CRDTType>(list1, fromCRDT, toCRDT);
    const mapped2 = new MappedCRDTOrderedMap<number, CRDTType>(list2, fromCRDT, toCRDT);

    mapped1.add('k', 4);

    expect(mapped1.entries).toEqual([['k', 4]]);
    expect(mapped2.entries).toEqual([['k', 4]]);
  });

  it('should update wrapped items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<MappedCRDTOrderedMapMapType<CRDTType>>('list');
    const list2 = doc2.getMap<MappedCRDTOrderedMapMapType<CRDTType>>('list');

    const mapped1 = new MappedCRDTOrderedMap<TestClass, CRDTType>(
      list1,
      fromCRDTTestClass,
      toCRDTTestClass
    );
    const mapped2 = new MappedCRDTOrderedMap<TestClass, CRDTType>(
      list2,
      fromCRDTTestClass,
      toCRDTTestClass
    );

    mapped1.add('k', TestClass.fromValue(4));

    expect(mapped1.entries.map(([, v]) => v.value)).toEqual([4]);
    expect(mapped2.entries.map(([, v]) => v.value)).toEqual([4]);

    list1.get('k')?.get('value')!.set('value', 10);

    expect(mapped1.entries.map(([, v]) => v.value)).toEqual([10]);
    expect(mapped2.entries.map(([, v]) => v.value)).toEqual([10]);
  });
});
