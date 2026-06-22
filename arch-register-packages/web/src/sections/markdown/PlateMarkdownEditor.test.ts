import { describe, expect, it } from 'vitest';
import { createListParagraph, isListParagraph } from './PlateMarkdownEditor';

describe('PlateMarkdownEditor list helpers', () => {
  it('marks Plate list paragraphs as list paragraphs', () => {
    expect(
      isListParagraph({
        type: 'p',
        indent: 1,
        listStyleType: 'disc',
        children: [{ text: 'Item' }]
      })
    ).toBe(true);
  });

  it('does not mark regular paragraphs as list paragraphs', () => {
    expect(
      isListParagraph({
        type: 'p',
        children: [{ text: 'Paragraph' }]
      })
    ).toBe(false);
  });

  it('creates Plate-compatible list paragraphs', () => {
    expect(createListParagraph('Item', 'decimal')).toEqual({
      type: 'p',
      indent: 1,
      listStyleType: 'decimal',
      children: [{ text: 'Item' }]
    });
  });
});
