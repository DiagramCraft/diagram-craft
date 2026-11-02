import { describe, expect, it, vi } from 'vitest';
import { handleWikiLinkTrigger } from './PlateMarkdownEditorWikiLinkInput';

const makeEditor = (before: string, inCodeBlock = false) => {
  const deleteBackward = vi.fn();
  const insertNodes = vi.fn();
  const editor = {
    selection: { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 1 } },
    api: {
      some: ({ match }: { match: (n: unknown) => boolean }) =>
        inCodeBlock && match({ type: 'code_block' }),
      range: () => ({}),
      string: () => before
    },
    tf: { deleteBackward, insertNodes }
  };
  return { editor: editor as never, deleteBackward, insertNodes };
};

describe('handleWikiLinkTrigger', () => {
  it('replaces "[" + "[" with a wiki link input node', () => {
    const { editor, deleteBackward, insertNodes } = makeEditor('[');
    expect(handleWikiLinkTrigger(editor, '[')).toBe(true);
    expect(deleteBackward).toHaveBeenCalledWith('character');
    expect(insertNodes).toHaveBeenCalledWith({
      type: 'wiki_link_input',
      children: [{ text: '' }]
    });
  });

  it('ignores a first "["', () => {
    const { editor, insertNodes } = makeEditor('a');
    expect(handleWikiLinkTrigger(editor, '[')).toBe(false);
    expect(insertNodes).not.toHaveBeenCalled();
  });

  it('ignores other characters and explicit positions', () => {
    const { editor } = makeEditor('[');
    expect(handleWikiLinkTrigger(editor, 'a')).toBe(false);
    expect(handleWikiLinkTrigger(editor, '[', { at: {} })).toBe(false);
  });

  it('ignores code blocks', () => {
    const { editor } = makeEditor('[', true);
    expect(handleWikiLinkTrigger(editor, '[')).toBe(false);
  });
});
