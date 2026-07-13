import { describe, expect, it } from 'vitest';
import { hasRenderableParts, optimisticConversationTitle } from './assistantViewModel';

describe('assistant view model', () => {
  it('recognizes text and supported approval tools', () => {
    expect(hasRenderableParts([{ type: 'text', content: '  ' }])).toBe(false);
    expect(hasRenderableParts([{ type: 'text', content: 'hello' }])).toBe(true);
    expect(
      hasRenderableParts([
        { type: 'tool-call', name: 'create_entity', approval: { needsApproval: true } }
      ])
    ).toBe(true);
  });

  it('caps optimistic titles at fifty characters', () => {
    expect(optimisticConversationTitle('short')).toBe('short');
    expect(optimisticConversationTitle('x'.repeat(60))).toBe(`${'x'.repeat(47)}...`);
  });
});
