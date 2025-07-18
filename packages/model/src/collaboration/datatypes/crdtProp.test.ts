import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { CRDTMap } from '../crdt';
import { NoOpCRDTMap } from '../noopCrdt';
import { describe, expect, it } from 'vitest';
import { CRDTProp } from './crdtProp';

type TestType = { value: string };

describe('CRDTProp', () => {
  it('should get and set values correctly', () => {
    const map = new WatchableValue<CRDTMap<TestType>>(new NoOpCRDTMap<TestType>());
    const prop = new CRDTProp(map, 'value');

    prop.set('test');
    expect(prop.get()).toBe('test');
    expect(map.get().get('value')).toBe('test');
  });
});
