import { createPlatePlugin, useEditorRef, type PlateElementProps } from 'platejs/react';
import { ElementApi, getPluginType, type TElement } from 'platejs';
import {
  convertChildrenDeserialize,
  convertNodesSerialize,
  parseAttributes,
  propsToAttributes,
  type MdMdxJsxFlowElement
} from '@platejs/markdown';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EditorBlock, getNodeText } from '../../../editor/EditorBlock';
import { COLUMN_TYPE } from './ColumnEditable';
import type { ColumnsSlateElement } from './types';
import styles from './Columns.module.css';

export const COLUMNS_TYPE = 'Columns' as const;

const emptyColumn = (): TElement => ({
  type: COLUMN_TYPE,
  children: [{ type: 'p', children: [{ text: '' }] }]
});

export const columnsMdxRule: MdxRuleDef<ColumnsSlateElement, 'block'> = {
  deserialize: (mdastNode, deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    const deserializedChildren = convertChildrenDeserialize(
      mdastNode.children ?? [],
      deco,
      options
    ) as TElement[];
    const columnChildren = deserializedChildren.filter(
      child => typeof child === 'object' && child !== null && child.type === COLUMN_TYPE
    );

    // `parseAttributes` runs each raw attribute value through `JSON.parse`, so a
    // `count="3"` MDX attribute arrives here as the number 3, not the string
    // "3" (mirrors the `numbered` boolean coercion in Caption's own mdxRule).
    const rawCount = attrs['count'];

    return {
      children: columnChildren.length > 0 ? columnChildren : [emptyColumn(), emptyColumn()],
      type: getPluginType(options.editor!, COLUMNS_TYPE),
      count: rawCount === 3 || rawCount === '3' ? '3' : '2'
    };
  },
  serialize: (slateNode, options) => ({
    attributes: propsToAttributes({ count: slateNode.count === '3' ? '3' : '2' }),
    // convertNodesSerialize returns generic unist nodes; the mdast-mdx typings
    // don't narrow that to MdxJsxFlowElement's own child union, so this cast
    // is the one framework-seam assertion this rule needs (see AllowedPropKey
    // design notes in defineMdxComponent.ts).
    children: convertNodesSerialize(
      slateNode.children ?? [],
      options
    ) as MdMdxJsxFlowElement['children'],
    name: COLUMNS_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

const isEmptyPlaceholder = (kids: TElement[]) =>
  kids.length === 1 &&
  kids[0]?.type === 'p' &&
  getNodeText(kids[0] as Record<string, unknown>) === '';

export const ColumnsEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<ColumnsSlateElement>) => {
  const editor = useEditorRef();
  const count = element.count === '3' ? '3' : '2';

  const setCount = (next: '2' | '3') => {
    const path = editor.api.findPath(element);
    if (!path) return;
    const idx = path[0]!;

    if (next === count) return;

    if (next === '3') {
      editor.tf.insertNodes(emptyColumn(), { at: [idx, 2] });
    } else {
      const columnsNode = editor.children[idx] as TElement;
      const cols = (columnsNode.children ?? []) as TElement[];
      const third = cols[2];
      if (third) {
        const thirdChildren = (third.children ?? []) as TElement[];
        if (!isEmptyPlaceholder(thirdChildren)) {
          const second = cols[1];
          const secondChildCount = ((second?.children ?? []) as TElement[]).length;
          editor.tf.insertNodes(thirdChildren, { at: [idx, 1, secondChildCount] });
        }
        editor.tf.removeNodes({ at: [idx, 2] });
      }
    }
    editor.tf.setNodes({ count: next }, { at: [idx] });
  };

  return (
    <EditorBlock element={element} {...props}>
      <div className={styles.editorContainer}>
        <div contentEditable={false} className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.presetButton} ${count === '2' ? styles.presetButtonActive : ''}`}
            onMouseDown={event => {
              event.stopPropagation();
              setCount('2');
            }}
          >
            2 columns
          </button>
          <button
            type="button"
            className={`${styles.presetButton} ${count === '3' ? styles.presetButtonActive : ''}`}
            onMouseDown={event => {
              event.stopPropagation();
              setCount('3');
            }}
          >
            3 columns
          </button>
        </div>
        <div
          className={`${styles.grid} ${styles.editorGrid} ${count === '3' ? styles.threeCol : styles.twoCol}`}
        >
          {children}
        </div>
      </div>
    </EditorBlock>
  );
};

/**
 * Enforces that a Columns element's direct children are only Column elements,
 * and that at least two are always present, since the preview parser only ever
 * represents a Columns node as wrapping Column children (see columnsMdxRule
 * above). Preset switching (2↔3 columns) is handled explicitly by setCount
 * above, not here, so this never fights that content-preserving merge/split.
 */
export const ColumnsNormalizePlugin = createPlatePlugin({
  key: 'columns-normalize',
  extendEditor({ editor }) {
    // biome-ignore lint/suspicious/noExplicitAny: Plate editor API requires flexible typing
    const normalizeNode = editor.normalizeNode as (entry: any) => void;
    // biome-ignore lint/suspicious/noExplicitAny: Plate editor API requires flexible typing
    editor.normalizeNode = (entry: any) => {
      const [node, path] = entry;
      if (ElementApi.isElement(node) && node.type === COLUMNS_TYPE) {
        const kids = (node.children ?? []) as TElement[];
        const badIndex = kids.findIndex(kid => kid.type !== COLUMN_TYPE);
        if (badIndex !== -1) {
          editor.tf.removeNodes({ at: [...path, badIndex] });
          return;
        }
        if (kids.length < 2) {
          editor.tf.insertNodes(emptyColumn(), { at: [...path, kids.length] });
          return;
        }
      }
      normalizeNode(entry);
    };
    return editor;
  }
});
