import { describe, expect, test } from 'vitest';
import { defaultNodeRegistry } from './defaultRegistry';

describe('defaultNodeRegistry', () => {
  test('registers partial-rect exactly once', () => {
    const registry = defaultNodeRegistry();
    const types = Array.from(registry.list());

    expect(types.filter(type => type === 'partial-rect')).toHaveLength(1);
  });
});
