import { useLayoutEffect, useRef } from 'react';
import { useEditorRef, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import {
  convertChildrenDeserialize,
  convertNodesSerialize,
  parseAttributes,
  propsToAttributes,
  type MdMdxJsxFlowElement
} from '@platejs/markdown';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EditorBlock } from '../../../editor/EditorBlock';
import type { FoldableSectionSlateElement } from './types';
import styles from './FoldableSection.module.css';

export const FOLDABLE_SECTION_TYPE = 'FoldableSection' as const;

export const foldableSectionMdxRule: MdxRuleDef<FoldableSectionSlateElement, 'block'> = {
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
      type: getPluginType(options.editor!, FOLDABLE_SECTION_TYPE),
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
    name: FOLDABLE_SECTION_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const FoldableSectionEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<FoldableSectionSlateElement>) => {
  const editor = useEditorRef();
  const labelRef = useRef<HTMLInputElement>(null);

  // Uncontrolled: only resync the DOM when the label changed externally
  // (initial mount, undo/redo) — never while the user is typing, since
  // committing to Slate state on every keystroke re-renders the Slate tree
  // and steals focus back to the editor mid-word.
  useLayoutEffect(() => {
    const node = labelRef.current;
    if (!node) return;
    const elLabel = element.label ?? '';
    if (node.value !== elLabel) {
      node.value = elLabel;
    }
  }, [element.label]);

  const commitLabel = () => {
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.setNodes({ label: labelRef.current?.value ?? '' }, { at: path });
  };

  return (
    <EditorBlock element={element} {...props}>
      <div className={`${styles.container} ${styles.editorContainer}`}>
        <div contentEditable={false} className={styles.labelWrap}>
          {/*
            A native <input>, not a contentEditable span: like the callout
            block's variant select and the caption block's textarea, native
            form controls are excluded from Slate's beforeinput interception,
            so this works inside a contentEditable region without blocking
            typing in the sibling rich-text children. The section is always
            shown expanded in the editor so the label and body can both be
            edited; collapsing only applies to the read-only preview.
          */}
          <input
            ref={labelRef}
            type="text"
            className={styles.labelInput}
            placeholder="Section label…"
            defaultValue={element.label ?? ''}
            onMouseDown={event => event.stopPropagation()}
            onBlur={commitLabel}
          />
        </div>
        <div className={styles.editorBody}>{children}</div>
      </div>
    </EditorBlock>
  );
};
