/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { MappedCRDTMap, type MappedCRDTMapMapType } from '../datatypes/mapped/mappedCrdtMap';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { YJSMap } from './yjsCrdt';
import type { CRDTMapper } from '../datatypes/mapped/mappedCrdt';
import type { CRDTMap } from '../crdt';

class TestClass {
  constructor(public crdt: CRDTMap<CRDTType>) {}

  get value() {
    return this.crdt.get('value')!;
  }

  set value(value: number) {
    this.crdt.set('value', value);
  }

  static fromValue(value: number) {
    const map = new YJSMap<CRDTType>();
    map.set('value', value);
    return new TestClass(map);
  }
}

const testClassMapper: CRDTMapper<TestClass, CRDTType> = {
  fromCRDT(e: CRDTMap<CRDTType>): TestClass {
    return new TestClass(e);
  },

  toCRDT(e: TestClass): CRDTMap<CRDTType> {
    return e.crdt;
  }
};

const mapper: CRDTMapper<number, CRDTType> = {
  fromCRDT(e: CRDTMap<CRDTType>): number {
    return e.get('value')! * 2;
  },
  toCRDT(e: number): CRDTMap<CRDTType> {
    const map = new YJSMap<CRDTType>();
    map.set('value', e / 2);
    return map;
  }
};

type CRDTType = { value: number };

describe('YJS MappedCRDTMap', () => {
  setupYJS();

  it('should correctly initialize entries from the fromCRDT function', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<any>('list');
    const list2 = doc2.getMap<any>('list');

    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, mapper);
    const mapped2 = new MappedCRDTMap<number, CRDTType>(list2, mapper);

    expect(Array.from(mapped1.entries)).toEqual([]);
    expect(Array.from(mapped2.entries)).toEqual([]);
  });

  it('should remove items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<any>('list');
    const list2 = doc2.getMap<any>('list');

    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, mapper);
    const mapped2 = new MappedCRDTMap<number, CRDTType>(list2, mapper);

    mapped1.add('k', 4);

    const removed = mapped1.remove('k');
    expect(removed).toBe(true);

    expect(Array.from(mapped1.entries)).toEqual([]);
    expect(Array.from(list1.entries())).toEqual([]);
    expect(Array.from(mapped2.entries)).toEqual([]);
    expect(Array.from(list2.entries())).toEqual([]);
  });

  it('should add items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<any>('list');
    const list2 = doc2.getMap<any>('list');

    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, mapper);
    const mapped2 = new MappedCRDTMap<number, CRDTType>(list2, mapper);

    mapped1.add('k', 4);

    expect(Array.from(mapped1.entries)).toEqual([['k', 4]]);
    expect(Array.from(mapped2.entries)).toEqual([['k', 4]]);
  });

  it('should update wrapped items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list');
    const list2 = doc2.getMap<MappedCRDTMapMapType<CRDTType>>('list');

    const mapped1 = new MappedCRDTMap<TestClass, CRDTType>(list1, testClassMapper);
    const mapped2 = new MappedCRDTMap<TestClass, CRDTType>(list2, testClassMapper);

    const t = TestClass.fromValue(4);
    mapped1.add('k', t);

    expect(Array.from(mapped1.entries).map(([, v]) => v.value)).toEqual([4]);
    expect(Array.from(mapped2.entries).map(([, v]) => v.value)).toEqual([4]);

    t.value = 10;

    expect(Array.from(mapped1.entries).map(([, v]) => v.value)).toEqual([10]);
    expect(Array.from(mapped2.entries).map(([, v]) => v.value)).toEqual([10]);
  });
});
