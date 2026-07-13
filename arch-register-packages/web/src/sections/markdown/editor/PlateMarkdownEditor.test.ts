import { describe, expect, it } from 'vitest';
import { createPlateEditor, createPlatePlugin } from 'platejs/react';
import { deserializeMd, MarkdownPlugin, remarkMdx, serializeMd } from '@platejs/markdown';
import { ListPlugin } from '@platejs/list/react';
import remarkGfm from 'remark-gfm';
import { createListParagraph, isListParagraph, isTodoListParagraph } from './EditorBlock';

const createMarkdownTestEditor = () =>
  createPlateEditor({
    plugins: [
      MarkdownPlugin.configure({ options: { remarkPlugins: [remarkMdx, remarkGfm] } }),
      ListPlugin,
      createPlatePlugin({ key: 'p', node: { isElement: true } })
    ]
  });

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

  it('identifies deserialized checklist paragraphs as todo items', () => {
    expect(
      isTodoListParagraph({
        type: 'p',
        indent: 1,
        listStyleType: 'todo',
        checked: false,
        children: [{ text: 'Not done' }]
      })
    ).toBe(true);
  });

  it('deserializes and updates checklist state without converting it to a numbered list', () => {
    const editor = createMarkdownTestEditor();
    editor.tf.setValue(deserializeMd(editor, '- [x] Done\n- [ ] Not done'));

    expect(editor.children).toEqual([
      expect.objectContaining({ listStyleType: 'todo', checked: true }),
      expect.objectContaining({ listStyleType: 'todo', checked: false })
    ]);

    editor.tf.setNodes({ checked: true }, { at: [1] });

    expect(serializeMd(editor)).toBe('* [x] Done\n* [x] Not done\n');
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
