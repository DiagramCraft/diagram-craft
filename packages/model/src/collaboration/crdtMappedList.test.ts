import { describe, expect, it } from 'vitest';
import { NoOpCRDTList } from './noopCrdt';
import { CRDTMappedList } from './crdtMappedList';

const factory = (e: number) => e * 2;
const toCRDT = (e: number) => e / 2;

describe('CRDTMappedList', () => {
  it('should correctly initialize entries from the factory function', () => {
    const mappedList = new CRDTMappedList(new NoOpCRDTList<number>(), factory, toCRDT);

    expect(mappedList.entries).toEqual([]);
  });

  it('should push and map items correctly', () => {
    const mockList = new NoOpCRDTList<number>();
    const mappedList = new CRDTMappedList(mockList, factory, toCRDT);

    mappedList.add(4);
    expect(mappedList.entries).toEqual([4]);
    expect(mockList.toArray()).toEqual([2]);
  });

  it('should remove items correctly', () => {
    const mockList = new NoOpCRDTList<number>();
    const mappedList = new CRDTMappedList(mockList, factory, toCRDT);

    mappedList.add(4);
    const removed = mappedList.remove(4);
    expect(removed).toBe(true);
    expect(mappedList.entries).toEqual([]);
    expect(mockList.toArray()).toEqual([]);
  });

  it('should handle remoteInsert events from CRDTList', () => {
    const mockList = new NoOpCRDTList<number>();
    const mappedList = new CRDTMappedList(mockList, factory, toCRDT);

    mockList.emit('remoteInsert', { index: 0, value: [1, 2, 3] });
    expect(mappedList.entries).toEqual([2, 4, 6]);
  });

  it('should handle remoteDelete events from CRDTList', () => {
    const mockList = new NoOpCRDTList<number>();
    const mappedList = new CRDTMappedList(mockList, factory, toCRDT);

    mockList.emit('remoteInsert', { index: 0, value: [1, 2, 3] });
    mockList.emit('remoteDelete', { index: 1, count: 1 });
    expect(mappedList.entries).toEqual([2, 6]);
  });

  it('should return correct index using indexOf', () => {
    const mockList = new NoOpCRDTList<number>();
    const mappedList = new CRDTMappedList(mockList, factory, toCRDT);

    mockList.emit('remoteInsert', { index: 0, value: [1, 2, 3] });
    expect(mappedList.indexOf(4)).toBe(1);
    expect(mappedList.indexOf(10)).toBe(-1);
  });

  it('should correctly serialize to JSON', () => {
    const mockList = new NoOpCRDTList<number>();
    const mappedList = new CRDTMappedList(mockList, factory, toCRDT);

    mockList.emit('remoteInsert', { index: 0, value: [1, 2, 3] });
    expect(mappedList.toJSON()).toEqual([2, 4, 6]);
  });
});
