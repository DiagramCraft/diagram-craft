import { describe, expect, it, vi } from 'vitest';
import { CRDT, CRDTMap } from './crdt';
import { NoOpCRDTMap } from './noopCrdt';

type TestType = { value: string };

describe('CRDT', () => {
  describe('makeProp', () => {
    it('should get and set values correctly', () => {
      const map: CRDTMap<TestType> = new NoOpCRDTMap<TestType>();
      const prop = CRDT.makeProp('value', map);

      prop.set('test');
      expect(prop.get()).toBe('test');
      expect(map.get('value')).toBe('test');
    });

    it('should call onChange when value is updated locally', () => {
      const map: CRDTMap<TestType> = new NoOpCRDTMap<TestType>();
      const onChange = vi.fn();
      const prop = CRDT.makeProp('value', map, onChange);
      prop.set('test');

      prop.set('new value');
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
