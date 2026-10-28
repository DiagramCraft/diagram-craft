import { describe, expect, it } from 'vitest';
import { isGraphTooLarge, MAX_GRAPH_ELEMENTS } from './graphSizeLimit';

describe('isGraphTooLarge', () => {
  it('allows a graph up to the limit', () => {
    expect(isGraphTooLarge(600, MAX_GRAPH_ELEMENTS - 600)).toBe(false);
  });

  it('counts nodes and edges together', () => {
    expect(isGraphTooLarge(600, MAX_GRAPH_ELEMENTS - 600 + 1)).toBe(true);
    expect(isGraphTooLarge(MAX_GRAPH_ELEMENTS + 1, 0)).toBe(true);
  });
});
