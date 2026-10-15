import type { MdRules } from '@platejs/markdown';
import { MarkdownPlugin, remarkMdx } from '@platejs/markdown';
import { DndPlugin } from '@platejs/dnd';
import { ListPlugin } from '@platejs/list/react';
import { SlashPlugin, SlashInputPlugin } from '@platejs/slash-command/react';
import remarkGfm from 'remark-gfm';
import { NodeIdPlugin, type TElement } from 'platejs';
import { createPlatePlugin } from 'platejs/react';
import type { EditorSpec } from '../mdx-components/types';
import { getWidgetDefinitions } from '../mdx-components/widgetRegistry';
import { CaptionNormalizePlugin } from '../mdx-components/blocks/caption/CaptionEditable';
import { ColumnsNormalizePlugin } from '../mdx-components/blocks/columns/ColumnsEditable';
import { TabsNormalizePlugin } from '../mdx-components/blocks/tabs/TabsEditable';
import {
  BlockquoteElement,
  BoldLeaf,
  CodeBlockElement,
  CodeLineElement,
  H1Element,
  H2Element,
  H3Element,
  InlineCodeLeaf,
  HrElement,
  ItalicLeaf,
  LinkElement,
  ListElement,
  ListItemContentElement,
  ListItemElement,
  PElement,
  StrikethroughLeaf
} from './PlateMarkdownEditorElements';
import {
  TableCellElement,
  TableElement,
  TableHeaderCellElement,
  TableRowElement
} from './PlateMarkdownEditorTable';
import { SlashInputElement } from './PlateMarkdownEditorSlashCommands';

const HEADING_TYPES = new Set(['h1', 'h2', 'h3']);
const mdxDefinitions = getWidgetDefinitions('mdx');

export const HeadingBreakPlugin = createPlatePlugin({
  key: 'heading-break',
  extendEditor({ editor }) {
    const insertBreak = editor.insertBreak as (() => void) | undefined;
    editor.insertBreak = () => {
      const { selection } = editor;
      if (selection) {
        const topIndex = selection.anchor.path[0];
        const block =
          topIndex !== undefined ? (editor.children[topIndex] as TElement | undefined) : undefined;
        if (block && HEADING_TYPES.has(block.type as string)) {
          editor.tf.splitNodes({ always: true });
          editor.tf.setNodes({ type: 'p' });
          return;
        }
        // For void blocks, always insert a paragraph immediately after and move cursor there.
        if (block && topIndex !== undefined && editor.api.isVoid(block)) {
          const nextIndex = topIndex + 1;
          editor.tf.insertNodes({ type: 'p', children: [{ text: '' }] }, { at: [nextIndex] });
          editor.tf.select({ path: [nextIndex, 0], offset: 0 });
          return;
        }
      }
      insertBreak?.();
    };
    return editor;
  }
});

export const mdxRules: MdRules = Object.fromEntries(
  mdxDefinitions.flatMap(({ type, mdx }) =>
    mdx.editorSpec?.mdxRule ? [[type, mdx.editorSpec.mdxRule] as const] : []
  )
);

const createMdxElementPlugin = (name: string, editorSpec: EditorSpec) =>
  createPlatePlugin({
    key: name,
    node: { isElement: true, ...editorSpec.nodeOptions }
  }).withComponent(editorSpec.editableComponent);

const mdxElementPlugins = mdxDefinitions.flatMap(({ type, mdx }) => {
  if (!mdx.editorSpec) return [];
  return [createMdxElementPlugin(type, mdx.editorSpec)];
});

export const editorPlugins = [
  NodeIdPlugin,
  MarkdownPlugin.configure({ options: { rules: mdxRules, remarkPlugins: [remarkMdx, remarkGfm] } }),
  DndPlugin,
  SlashPlugin,
  SlashInputPlugin.withComponent(SlashInputElement),
  HeadingBreakPlugin,
  createPlatePlugin({ key: 'p', node: { isElement: true } }).withComponent(PElement),
  createPlatePlugin({ key: 'h1', node: { isElement: true } }).withComponent(H1Element),
  createPlatePlugin({ key: 'h2', node: { isElement: true } }).withComponent(H2Element),
  createPlatePlugin({ key: 'h3', node: { isElement: true } }).withComponent(H3Element),
  createPlatePlugin({
    key: 'blockquote',
    node: { isElement: true }
  }).withComponent(BlockquoteElement),
  createPlatePlugin({
    key: 'code_block',
    node: { isElement: true }
  }).withComponent(CodeBlockElement),
  createPlatePlugin({
    key: 'code_line',
    node: { isElement: true }
  }).withComponent(CodeLineElement),
  ListPlugin.withComponent(ListElement),
  createPlatePlugin({ key: 'li', node: { isElement: true } }).withComponent(ListItemElement),
  createPlatePlugin({ key: 'lic', node: { isElement: true } }).withComponent(
    ListItemContentElement
  ),
  createPlatePlugin({
    key: 'a',
    node: { isElement: true, isInline: true }
  }).withComponent(LinkElement),
  createPlatePlugin({
    key: 'hr',
    node: { isElement: true, isVoid: true }
  }).withComponent(HrElement),
  createPlatePlugin({ key: 'table', node: { isElement: true } }).withComponent(TableElement),
  createPlatePlugin({ key: 'tr', node: { isElement: true } }).withComponent(TableRowElement),
  createPlatePlugin({ key: 'td', node: { isElement: true } }).withComponent(TableCellElement),
  createPlatePlugin({ key: 'th', node: { isElement: true } }).withComponent(TableHeaderCellElement),
  ...mdxElementPlugins,
  CaptionNormalizePlugin,
  ColumnsNormalizePlugin,
  TabsNormalizePlugin,
  createPlatePlugin({ key: 'bold', node: { isLeaf: true } }).withComponent(BoldLeaf),
  createPlatePlugin({ key: 'italic', node: { isLeaf: true } }).withComponent(ItalicLeaf),
  createPlatePlugin({ key: 'code', node: { isLeaf: true } }).withComponent(InlineCodeLeaf),
  createPlatePlugin({ key: 'strikethrough', node: { isLeaf: true } }).withComponent(
    StrikethroughLeaf
  )
];
