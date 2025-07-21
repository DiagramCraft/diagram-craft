import { watch } from '@diagram-craft/utils/watchableValue';
import { describe, expect, it } from 'vitest';
import { CRDTProp } from './crdtProp';
import { Backends } from '../yjs/collaborationTestUtils';

type TestType = { value: string };

describe.each(Backends.all())('CRDTProp [%s]', (_name, backend) => {
  it('should get and set values correctly', () => {
    const [root1] = backend.syncedDocs();

    const map = watch(root1.getMap<TestType>('test'));
    const prop = new CRDTProp(map, 'value');

    prop.set('test');
    expect(prop.get()).toBe('test');
    expect(map.get().get('value')).toBe('test');
  });

  it('should sync changes', () => {
    // Setup
    const [root1, root2] = backend.syncedDocs();

    const map1 = watch(root1.getMap<TestType>('test'));
    const prop1 = new CRDTProp(map1, 'value');

    const map2 = root2 ? watch(root2.getMap<TestType>('test')) : undefined;
    const prop2 = map2 ? new CRDTProp(map2, 'value') : undefined;

    // Act
    prop1.set('test');

    // Verify
    expect(prop1.get()).toBe('test');
    expect(map1.get().get('value')).toBe('test');
    if (map2) {
      expect(prop2!.get()).toBe('test');
      expect(map2.get().get('value')).toBe('test');
    }
  });
});
