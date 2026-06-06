import { describe, expect, it } from 'vitest';
import { toDiagramCraftField } from './public-shape.js';

describe('toDiagramCraftField', () => {
  it('keeps date fields in public schema output', () => {
    expect(
      toDiagramCraftField({ id: 'go_live', name: 'Go Live', type: 'date' })
    ).toEqual({
      id: 'go_live',
      name: 'Go Live',
      type: 'date',
    });
  });
});
