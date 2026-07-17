import { describe, expect, it, vi } from 'vitest';
import { watch } from '@diagram-craft/utils/watchableValue';
import { type CRDTFactory, type CRDTMap } from '../../crdt';
import type { CRDTMapper } from './types';
import { MappedCRDTMap, type MappedCRDTMapMapType } from './mappedCrdtMap';
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

describe.each(Backends.all())('MappedCRDTMap [%s]', (_name, backend) => {
  it('should correctly initialize entries from the fromCRDT function', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const list2 = doc2 ? watch(doc2.getMap<MappedCRDTMapMapType<CRDTType>>('list')) : undefined;

    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = list2
      ? new MappedCRDTMap<number, CRDTType>(list2, makeMapper(doc1.factory))
      : undefined;

    expect(Array.from(mapped1.entries)).toEqual([]);
    if (mapped2) expect(Array.from(mapped2.entries)).toEqual([]);
  });

  it('should remove items correctly', () => {
    const [doc1, doc2] = backend.syncedDocs();

    const list1 = watch(doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const list2 = doc2 ? watch(doc2.getMap<MappedCRDTMapMapType<CRDTType>>('list')) : undefined;

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

    const list1 = watch(doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const list2 = doc2 ? watch(doc2.getMap<MappedCRDTMapMapType<CRDTType>>('list')) : undefined;

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

    const mockList = watch(doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, makeMapper(doc1.factory));

    mappedList.add('a', 4);
    mappedList.add('b', 5);

    expect(mappedList.toJSON()).toEqual({
      a: 4,
      b: 5
    });
  });

  it('should preserve remote callback payloads and timing', () => {
    const [doc1, doc2] = backend.syncedDocs();
    if (!doc2) return;

    const list1 = watch(doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const list2 = watch(doc2.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const onAdd = vi.fn();
    const onChange = vi.fn();
    const onRemove = vi.fn();
    const mapped1 = new MappedCRDTMap<number, CRDTType>(list1, makeMapper(doc1.factory));
    const mapped2 = new MappedCRDTMap<number, CRDTType>(list2, makeMapper(doc2.factory), {
      onRemoteAdd: onAdd,
      onRemoteChange: onChange,
      onRemoteRemove: onRemove
    });

    mapped1.add('k', 4);
    expect(onAdd).toHaveBeenCalledWith(4);
    expect(mapped2.get('k')).toBe(4);

    mapped1.set('k', 6);
    expect(onChange).toHaveBeenCalledWith(6);
    expect(mapped2.get('k')).toBe(6);

    mapped1.remove('k');
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove.mock.calls[0]?.[0]).toBe('k');
    expect(Number.isNaN(onRemove.mock.calls[0]?.[1])).toBe(true);
    expect(mapped2.get('k')).toBeUndefined();
  });

  it('should replace the root and release listeners without duplication', () => {
    const [doc1] = backend.syncedDocs();
    const initial = doc1.factory.makeMap<MappedCRDTMapMapType<CRDTType>>();
    const replacement = doc1.factory.makeMap<MappedCRDTMapMapType<CRDTType>>({
      replacement: doc1.factory.makeMap<CRDTType>({ value: 4 })
    });
    const root = watch(initial);
    const onInit = vi.fn();
    const mapped = new MappedCRDTMap<number, CRDTType>(root, makeMapper(doc1.factory), { onInit });

    expect(onInit).not.toHaveBeenCalled();
    root.set(replacement);
    expect(onInit).toHaveBeenCalledTimes(1);
    expect(mapped.toJSON()).toEqual({ replacement: 8 });

    mapped.release();
    mapped.release();
    root.set(initial);
    expect(onInit).toHaveBeenCalledTimes(1);
  });

  it('should retain direct mapped values in the CRDT wire representation', () => {
    const [doc1] = backend.syncedDocs();
    const list = watch(doc1.getMap<MappedCRDTMapMapType<CRDTType>>('list'));
    const mapped = new MappedCRDTMap<number, CRDTType>(list, makeMapper(doc1.factory));

    mapped.add('k', 4);

    expect(list.get().get('k')?.get('value')).toBe(2);
  });
});
