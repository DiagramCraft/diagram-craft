import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { CollaborationAwareness } from './CollaborationAwareness';

describe('CollaborationAwareness', () => {
  beforeEach(() => {
    CollaborationConfig.isNoOp = true;
  });

  test('is initialized from the configured awareness identity', () => {
    const awareness = new CollaborationAwareness({
      name: () => 'Alice',
      color: () => '#123456'
    });

    expect(awareness.state).toEqual({ name: 'Alice', color: '#123456' });
  });

  test('updates the collaboration identity and emits only when it changes', () => {
    const awareness = new CollaborationAwareness({
      name: () => 'Alice',
      color: () => '#123456'
    });
    const change = vi.fn();
    awareness.on('change', change);

    awareness.state = { name: 'Bob', color: '#abcdef' };
    awareness.state = { name: 'Bob', color: '#abcdef' };

    expect(awareness.state).toEqual({ name: 'Bob', color: '#abcdef' });
    expect(change).toHaveBeenCalledTimes(1);
  });

  test('is scoped to an editor instance', () => {
    const first = new CollaborationAwareness({ name: () => 'First', color: () => 'red' });
    const second = new CollaborationAwareness({ name: () => 'Second', color: () => 'blue' });

    first.state = { name: 'Updated', color: 'green' };

    expect(first.state.name).toBe('Updated');
    expect(second.state).toEqual({ name: 'Second', color: 'blue' });
  });
});
