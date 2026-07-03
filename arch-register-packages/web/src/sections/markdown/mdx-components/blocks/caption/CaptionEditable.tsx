import { useLayoutEffect, useRef } from 'react';
import { createPlatePlugin, type PlateElementProps, useEditorRef } from 'platejs/react';
import { ElementApi, getPluginType, type TElement } from 'platejs';
import {
  convertChildrenDeserialize,
  convertNodesSerialize,
  parseAttributes,
  propsToAttributes
} from '@platejs/markdown';
import { EditorBlock, getNodeText } from '../../../editor/EditorBlock';
import type { CaptionSlateElement } from './types';
import styles from './Caption.module.css';

export const CAPTION_TYPE = 'Caption' as const;

const alignClass = (align?: string) => {
  if (align === 'left') return styles.alignLeft;
  if (align === 'right') return styles.alignRight;
  return styles.alignCenter;
};

// biome-ignore lint/suspicious/noExplicitAny: MDX plugin API requires flexible typing
export const captionMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: ok
  deserialize: (mdastNode: any, deco: any, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    const deserializedChildren = convertChildrenDeserialize(
      mdastNode.children ?? [],
      deco,
      options
    );
    const hasValidChild = deserializedChildren.some(
      (child: unknown) =>
        typeof child === 'object' &&
        child !== null &&
        'type' in child &&
        (child as { type?: unknown }).type !== getPluginType(options.editor, 'p')
    );

    return {
      children: hasValidChild
        ? deserializedChildren
        : [{ type: getPluginType(options.editor, 'p'), children: [{ text: '' }] }],
      type: getPluginType(options.editor, CAPTION_TYPE),
      caption: typeof attrs['caption'] === 'string' ? attrs['caption'] : '',
      align: typeof attrs['align'] === 'string' ? attrs['align'] : '',
      numbered: attrs['numbered'] === true || attrs['numbered'] === 'true'
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: ok
  serialize: (slateNode: any, options: any) => ({
    attributes: propsToAttributes({
      caption: slateNode.caption ?? '',
      ...(slateNode.align ? { align: slateNode.align } : {}),
      ...(slateNode.numbered ? { numbered: 'true' } : {})
    }),
    children: convertNodesSerialize(slateNode.children ?? [], options),
    name: CAPTION_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

const autoGrow = (node: HTMLTextAreaElement) => {
  node.style.height = 'auto';
  node.style.height = `${node.scrollHeight}px`;
};

export const CaptionEditable = ({ element, children, ...props }: PlateElementProps) => {
  const editor = useEditorRef();
  const el = element as CaptionSlateElement;
  const captionRef = useRef<HTMLTextAreaElement>(null);

  // Uncontrolled: only resync the DOM when the caption changed externally
  // (initial mount, undo/redo) — never while the user is typing, since we
  // don't commit to Slate state until blur.
  useLayoutEffect(() => {
    const node = captionRef.current;
    if (!node) return;
    const elText = el.caption ?? '';
    if (node.value !== elText) {
      node.value = elText;
    }
    autoGrow(node);
  }, [el.caption]);

  const commitCaption = () => {
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.setNodes({ caption: captionRef.current?.value ?? '' }, { at: path });
  };

  return (
    <EditorBlock element={element} {...props}>
      <figure className={`${styles.container} ${styles.editorContainer} ${alignClass(el.align)}`}>
        <div className={styles.body}>{children}</div>
        <figcaption contentEditable={false} className={styles.caption}>
          {/*
            A native <textarea>, not a contentEditable div: Slate's own
            beforeinput handler intercepts any element whose resolved
            isContentEditable is true (it can't tell a manually re-enabled
            contentEditable region apart from its own document), which
            silently blocks typing. Native form controls are explicitly
            excluded from that check, so this is styled to look like plain
            caption text instead.
          */}
          <textarea
            ref={captionRef}
            rows={1}
            className={styles.captionText}
            placeholder="Click here to edit the caption…"
            defaultValue={el.caption ?? ''}
            onInput={event => autoGrow(event.currentTarget)}
            onBlur={commitCaption}
          />
        </figcaption>
      </figure>
    </EditorBlock>
  );
};

/**
 * Enforces that a Caption element has at most one non-placeholder child, since
 * the read-only preview parser only ever represents a Caption as wrapping a
 * single block-level, non-wrapper MDX component.
 */
export const CaptionNormalizePlugin = createPlatePlugin({
  key: 'caption-normalize',
  extendEditor({ editor }) {
    // biome-ignore lint/suspicious/noExplicitAny: Plate editor API requires flexible typing
    const normalizeNode = editor.normalizeNode as (entry: any) => void;
    // biome-ignore lint/suspicious/noExplicitAny: Plate editor API requires flexible typing
    editor.normalizeNode = (entry: any) => {
      const [node, path] = entry;
      if (ElementApi.isElement(node) && node.type === CAPTION_TYPE) {
        const kids = (node.children ?? []) as TElement[];
        if (kids.length > 1) {
          const firstIsEmptyPlaceholder =
            kids[0]?.type === 'p' && getNodeText(kids[0] as Record<string, unknown>) === '';
          if (firstIsEmptyPlaceholder) {
            editor.tf.removeNodes({ at: [...path, 0] });
            return;
          }
          for (let i = kids.length - 1; i >= 1; i--) {
            editor.tf.removeNodes({ at: [...path, i] });
          }
          return;
        }
      }
      normalizeNode(entry);
    };
    return editor;
  }
});
