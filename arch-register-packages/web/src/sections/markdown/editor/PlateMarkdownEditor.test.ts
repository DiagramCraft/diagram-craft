import { describe, expect, it, vi } from 'vitest';
import { createPlateEditor, createPlatePlugin } from 'platejs/react';
import { deserializeMd, MarkdownPlugin, remarkMdx, serializeMd } from '@platejs/markdown';
import { ListPlugin } from '@platejs/list/react';
import remarkGfm from 'remark-gfm';
import type { SlateEditor, TElement } from 'platejs';
import { createListParagraph, isListParagraph, isTodoListParagraph } from './EditorBlock';
import {
  BUILTIN_SLASH_COMMANDS,
  insertOrReplaceBlock,
  insertOrReplaceInline,
  SLASH_COMMANDS
} from './PlateMarkdownEditorSlashCommands';
import { handleTableKeyDown } from './PlateMarkdownEditorTable';
import { editorPlugins, mdxRules } from './PlateMarkdownEditorPlugins';

vi.mock('../mdx-components/mdxRegistry', () => ({
  MDX_COMPONENTS: {
    TestBlock: {
      editorSpec: {
        editableComponent: () => null,
        nodeOptions: { isVoid: true },
        mdxRule: {
          deserialize: () => ({ type: 'TestBlock', children: [{ text: '' }] }),
          serialize: () => ({
            type: 'mdxJsxFlowElement',
            name: 'TestBlock',
            children: [],
            attributes: []
          })
        },
        slashCommand: {
          key: 'test-block',
          label: 'Test block',
          description: 'Test block',
          icon: 'T',
          onSelect: (
            editor: Parameters<typeof insertOrReplaceBlock>[0],
            helpers: { insertOrReplaceBlock: typeof insertOrReplaceBlock }
          ) => helpers.insertOrReplaceBlock(editor, { type: 'TestBlock', children: [{ text: '' }] })
        }
      }
    }
  }
}));

const createMarkdownTestEditor = () =>
  createPlateEditor({
    plugins: [
      MarkdownPlugin.configure({ options: { remarkPlugins: [remarkMdx, remarkGfm] } }),
      ListPlugin,
      createPlatePlugin({ key: 'p', node: { isElement: true } })
    ]
  });

type SlashEditor = Parameters<typeof insertOrReplaceBlock>[0];

const asSlashEditor = (editor: object) => editor as SlashEditor;

const makeSlashEditor = (children: unknown[], isVoid = false) => ({
  children,
  selection: { anchor: { path: [0, 0] } },
  api: {
    isVoid: vi.fn(() => isVoid),
    findPath: vi.fn(() => [0, 0])
  },
  tf: {
    removeNodes: vi.fn(),
    insertNodes: vi.fn(),
    select: vi.fn(),
    setNodes: vi.fn()
  }
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

describe('Plate Markdown plugin assembly', () => {
  it('collects MDX rules and plugins from the registry', () => {
    expect(mdxRules.TestBlock).toBeDefined();
    expect(editorPlugins.some(plugin => plugin.key === 'TestBlock')).toBe(true);
    expect(editorPlugins.some(plugin => plugin.key === 'heading-break')).toBe(true);
    expect(editorPlugins.some(plugin => plugin.key === 'table')).toBe(true);
  });

  it('keeps Markdown/GFM and MDX serialization wired through the assembled plugins', () => {
    const editor = createPlateEditor({ plugins: editorPlugins });
    editor.tf.setValue(deserializeMd(editor, '| Name | Value |\n| --- | --- |\n| A | B |'));

    expect(serializeMd(editor)).toContain('| Name | Value |');

    editor.tf.setValue(deserializeMd(editor, '<TestBlock />'));
    expect(editor.children).toEqual([
      expect.objectContaining({ type: 'TestBlock', children: [{ text: '' }] })
    ]);
    expect(serializeMd(editor)).toContain('<TestBlock />');
  });
});

describe('slash command insertion helpers', () => {
  it('replaces an empty paragraph and adds a trailing paragraph for void blocks', () => {
    const editor = makeSlashEditor([{ type: 'p', children: [{ text: '' }] }], true);
    const node = { type: 'TestBlock', children: [{ text: '' }] } as TElement;

    insertOrReplaceBlock(asSlashEditor(editor), node);

    expect(editor.tf.removeNodes).toHaveBeenCalledWith({ at: [0] });
    expect(editor.tf.insertNodes).toHaveBeenCalledWith(
      [node, { type: 'p', children: [{ text: '' }] }],
      { at: [0] }
    );
    expect(editor.tf.select).toHaveBeenCalledWith({ path: [1, 0], offset: 0 });
  });

  it('replaces an empty paragraph without adding a trailing paragraph for non-void blocks', () => {
    const editor = makeSlashEditor([{ type: 'p', children: [{ text: '' }] }]);
    const node = { type: 'blockquote', children: [{ text: '' }] } as TElement;

    insertOrReplaceBlock(asSlashEditor(editor), node);

    expect(editor.tf.removeNodes).toHaveBeenCalledWith({ at: [0] });
    expect(editor.tf.insertNodes).toHaveBeenCalledWith(node, { at: [0] });
    expect(editor.tf.select).not.toHaveBeenCalled();
  });

  it('moves the selection after an inserted inline element', () => {
    const editor = makeSlashEditor([{ type: 'p', children: [{ text: '' }] }]);
    editor.api.findPath.mockReturnValue([0, 1]);
    const node = { type: 'InlineThing', children: [{ text: '' }] } as TElement;

    insertOrReplaceInline(asSlashEditor(editor), node);

    expect(editor.tf.insertNodes).toHaveBeenCalledWith(node);
    expect(editor.tf.select).toHaveBeenCalledWith({ path: [0, 2], offset: 0 });
  });

  it('preserves the built-in table command node shape', () => {
    const editor = makeSlashEditor([{ type: 'p', children: [{ text: '' }] }]);
    const tableCommand = BUILTIN_SLASH_COMMANDS.find(command => command.key === 'table');

    expect(tableCommand).toBeDefined();
    tableCommand!.onSelect(asSlashEditor(editor));

    expect(editor.tf.insertNodes).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'table',
        children: expect.arrayContaining([
          expect.objectContaining({ type: 'tr' }),
          expect.objectContaining({ type: 'tr' })
        ])
      }),
      { at: [0] }
    );
  });

  it('includes registry-backed commands in the slash command list', () => {
    const command = SLASH_COMMANDS.find(item => item.key === 'test-block');

    expect(command).toBeDefined();
    const editor = makeSlashEditor([{ type: 'p', children: [{ text: '' }] }]);

    command!.onSelect(asSlashEditor(editor));

    expect(editor.tf.insertNodes).toHaveBeenCalledWith(
      { type: 'TestBlock', children: [{ text: '' }] },
      { at: [0] }
    );
  });
});

describe('table keyboard navigation', () => {
  it('moves down to the corresponding cell in the next row', () => {
    const editor = {
      children: [
        {
          type: 'table',
          children: [
            { type: 'tr', children: [{ type: 'td' }, { type: 'td' }] },
            { type: 'tr', children: [{ type: 'td' }, { type: 'td' }] }
          ]
        }
      ],
      selection: { focus: { path: [0, 0, 1] } },
      tf: { select: vi.fn() }
    } as unknown as SlateEditor;
    const event = {
      key: 'ArrowDown',
      preventDefault: vi.fn()
    } as unknown as Parameters<typeof handleTableKeyDown>[1];

    handleTableKeyDown(editor, event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(editor.tf.select).toHaveBeenCalledWith({ path: [0, 1, 1, 0], offset: 0 });
  });
});
