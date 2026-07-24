import { getPluginType } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import {
  convertChildrenDeserialize,
  convertNodesSerialize,
  parseAttributes,
  propsToAttributes,
  type MdMdxJsxFlowElement
} from '@platejs/markdown';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EditorBlock } from '../../../editor/EditorBlock';
import type { TabSlateElement } from './types';
import styles from './Tab.module.css';

export const TAB_TYPE = 'Tab' as const;

export const tabMdxRule: MdxRuleDef<TabSlateElement, 'block'> = {
  deserialize: (mdastNode, deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
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
      type: getPluginType(options.editor!, TAB_TYPE),
      label: typeof attrs['label'] === 'string' ? attrs['label'] : ''
    };
  },
  serialize: (slateNode, options) => ({
    attributes: propsToAttributes({ label: slateNode.label ?? '' }),
    // convertNodesSerialize returns generic unist nodes; the mdast-mdx typings
    // don't narrow that to MdxJsxFlowElement's own child union, so this cast
    // is the one framework-seam assertion this rule needs (see AllowedPropKey
    // design notes in defineMdxComponent.ts).
    children: convertNodesSerialize(
      slateNode.children ?? [],
      options
    ) as MdMdxJsxFlowElement['children'],
    name: TAB_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

// Label editing happens in the owning Tabs element's header row (it renders
// the real tab strip), so a Tab's own editable body is just its content —
// no label input here, unlike FoldableSection which owns its single label.
export const TabEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<TabSlateElement>) => {
  return (
    <EditorBlock element={element} {...props}>
      <div className={styles.panelBody}>{children}</div>
    </EditorBlock>
  );
};
