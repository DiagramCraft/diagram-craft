/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { NoOpCRDTMap } from './noopCrdt';
import { CRDT, CRDTMap } from './crdt';
import { MappedCRDTMap } from './mappedCRDTMap';

const fromCRDT = (e: CRDTMap<CRDTType>): number => {
  return e.get('value')! * 2;
};
const toCRDT = (e: number): CRDTMap<CRDTType> => {
  const map = new CRDT.Map();
  map.set('value', e / 2);
  return map;
};

type CRDTType = { value: number };

describe('MappedCRDTMap', () => {
  it('should correctly initialize entries from the fromCRDT function', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, fromCRDT, toCRDT);

    expect(Array.from(mappedList.entries)).toEqual([]);
  });

  it('should remove items correctly', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, fromCRDT, toCRDT);

    mappedList.add('a', 4);
    const removed = mappedList.remove('a');
    expect(removed).toBe(true);
    expect(Array.from(mappedList.entries)).toEqual([]);
    expect(Array.from(mockList.values())).toEqual([]);
  });

  it('should correctly serialize to JSON', () => {
    const mockList = new NoOpCRDTMap<any>();
    const mappedList = new MappedCRDTMap<number, CRDTType>(mockList, fromCRDT, toCRDT);

    mappedList.add('a', 4);
    mappedList.add('b', 5);

    expect(mappedList.toJSON()).toEqual({
      a: 4,
      b: 5
    });
  });
});
