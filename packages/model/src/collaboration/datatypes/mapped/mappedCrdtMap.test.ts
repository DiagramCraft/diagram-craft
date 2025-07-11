/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { MappedCRDTMap } from './mappedCrdtMap';
import { CRDTMapper } from './mappedCrdt';
import { NoOpCRDTMap } from '../../noopCrdt';
import type { CRDTMap } from '../../crdt';

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

describe('MappedCRDTMap', () => {
  it('should correctly initialize entries from the fromCRDT function', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, mapper);

    expect(Array.from(mappedList.entries)).toEqual([]);
  });

  it('should remove items correctly', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, mapper);

    mappedList.add('a', 4);
    const removed = mappedList.remove('a');
    expect(removed).toBe(true);
    expect(Array.from(mappedList.entries)).toEqual([]);
    expect(Array.from(mockList.values())).toEqual([]);
  });

  it('should correctly serialize to JSON', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, mapper);

    mappedList.add('a', 4);
    mappedList.add('b', 5);

    expect(mappedList.toJSON()).toEqual({
      a: 4,
      b: 5
    });
  });
});
