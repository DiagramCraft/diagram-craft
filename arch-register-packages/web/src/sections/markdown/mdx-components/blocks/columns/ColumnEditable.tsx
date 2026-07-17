import { getPluginType } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import {
  convertChildrenDeserialize,
  convertNodesSerialize,
  type MdMdxJsxFlowElement
} from '@platejs/markdown';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EditorBlock } from '../../../editor/EditorBlock';
import type { ColumnSlateElement } from './types';
import styles from './Column.module.css';

export const COLUMN_TYPE = 'Column' as const;

export const columnMdxRule: MdxRuleDef<ColumnSlateElement, 'block'> = {
  deserialize: (mdastNode, deco, options) => {
    const deserializedChildren = convertChildrenDeserialize(
      mdastNode.children ?? [],
      deco,
      options
    );
    const hasElementChild = deserializedChildren.some(
      child => typeof child === 'object' && child !== null && 'type' in child
    );

    return {
      children: hasElementChild
        ? deserializedChildren
        : [{ type: getPluginType(options.editor!, 'p'), children: [{ text: '' }] }],
      type: getPluginType(options.editor!, COLUMN_TYPE)
    };
  },
  serialize: (slateNode, options) => ({
    attributes: [],
    // convertNodesSerialize returns generic unist nodes; the mdast-mdx typings
    // don't narrow that to MdxJsxFlowElement's own child union, so this cast
    // is the one framework-seam assertion this rule needs (see AllowedPropKey
    // design notes in defineMdxComponent.ts).
    children: convertNodesSerialize(
      slateNode.children ?? [],
      options
    ) as MdMdxJsxFlowElement['children'],
    name: COLUMN_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const ColumnEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<ColumnSlateElement>) => {
  return (
    <EditorBlock element={element} {...props}>
      <div className={styles.columnBody}>{children}</div>
    </EditorBlock>
  );
};
