/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { NoOpCRDTMap } from './noopCrdt';
import { MappedCRDTOrderedMap } from './mappedCRDTOrderedMap';
import { CRDTMap } from './crdt';
import { CRDTMapper } from './mappedCRDT';

const mapper: CRDTMapper<number, CRDTType> = {
  fromCRDT(e: CRDTMap<CRDTType>): number {
    return e.get('value')! * 2;
  },
  toCRDT(e: number): CRDTMap<CRDTType> {
    const map = new NoOpCRDTMap<CRDTType>();
    map.set('value', e / 2);
    return map;
  }
};

type CRDTType = { value: number };

describe('MappedCRDTOrderedMap', () => {
  it('should correctly initialize entries from the fromCRDT function', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTOrderedMap<number, CRDTType>(mockList, mapper);

    expect(mappedList.entries).toEqual([]);
  });

  it('should remove items correctly', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTOrderedMap<number, CRDTType>(mockList, mapper);

    mappedList.add('a', 4);
    const removed = mappedList.remove('a');
    expect(removed).toBe(true);
    expect(mappedList.entries).toEqual([]);
    expect(Array.from(mockList.values())).toEqual([]);
  });

  it('should correctly serialize to JSON', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTOrderedMap<number, CRDTType>(mockList, mapper);

    mappedList.add('a', 4);
    mappedList.add('b', 5);

    expect(mappedList.toJSON()).toEqual({
      a: 4,
      b: 5
    });
  });
});
