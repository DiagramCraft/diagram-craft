import { describe, expect, it } from 'vitest';
import { CRDTMappedList } from '../crdtMappedList';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';

const factory = (e: number) => e * 2;
const toCRDT = (e: number) => e / 2;

describe('YJS CRDTMappedList', () => {
  setupYJS();

  it('should correctly initialize entries from the factory function', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getList('list');
    const list2 = doc2.getList('list');

    const mapped1 = new CRDTMappedList(list1, factory, toCRDT);
    const mapped2 = new CRDTMappedList(list2, factory, toCRDT);

    expect(mapped1.entries).toEqual([]);
    expect(mapped2.entries).toEqual([]);
  });

  it('should push and map items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getList('list');
    const list2 = doc2.getList('list');

    const mapped1 = new CRDTMappedList(list1, factory, toCRDT);
    const mapped2 = new CRDTMappedList(list2, factory, toCRDT);

    mapped1.add(4);
    expect(mapped1.entries).toEqual([4]);
    expect(list1.toArray()).toEqual([2]);

    expect(mapped2.entries).toEqual([4]);
    expect(list2.toArray()).toEqual([2]);
  });

  it('should remove items correctly', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const list1 = doc1.getList('list');
    const list2 = doc2.getList('list');

    const mapped1 = new CRDTMappedList(list1, factory, toCRDT);
    const mapped2 = new CRDTMappedList(list2, factory, toCRDT);

    mapped1.add(4);

    const removed = mapped1.remove(4);
    expect(removed).toBe(true);

    expect(mapped1.entries).toEqual([]);
    expect(list1.toArray()).toEqual([]);
    expect(mapped2.entries).toEqual([]);
    expect(list2.toArray()).toEqual([]);
  });
});
