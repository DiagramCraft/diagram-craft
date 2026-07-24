import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatAiActionSeedMessage,
  readAndClearAiActionSeed,
  writeAiActionSeed
} from './aiActionSeed';

describe('aiActionSeed', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a seed and clears it on read', () => {
    const seed = {
      documentTitle: 'Decision.md',
      documentLink: 'adr/decision.md',
      actionPrompt: 'Summarize the risks.',
      answer: 'The main risk is X.'
    };
    writeAiActionSeed(seed);

    expect(readAndClearAiActionSeed()).toEqual(seed);
    expect(readAndClearAiActionSeed()).toBeNull();
  });

  it('returns null when nothing was written', () => {
    expect(readAndClearAiActionSeed()).toBeNull();
  });

  it('returns null for malformed stored data instead of throwing', () => {
    sessionStorage.setItem('ai-action-seed', 'not json');

    expect(readAndClearAiActionSeed()).toBeNull();
  });

  it('formats the seed into a message quoting the prompt and answer', () => {
    const message = formatAiActionSeedMessage({
      documentTitle: 'Decision.md',
      documentLink: 'adr/decision.md',
      actionPrompt: 'Summarize the risks.',
      answer: 'The main risk is X.'
    });

    expect(message).toContain('Decision.md');
    expect(message).toContain('adr/decision.md');
    expect(message).toContain('Summarize the risks.');
    expect(message).toContain('The main risk is X.');
  });
});
