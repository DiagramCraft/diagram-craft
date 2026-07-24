import type { ReactNode } from 'react';
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
import {
  CALLOUT_VARIANTS,
  isCalloutVariant,
  type CalloutSlateElement,
  type CalloutVariant
} from './types';
import {
  TbAlertOctagon,
  TbAlertTriangle,
  TbCircleCheck,
  TbInfoCircle,
  TbNote
} from 'react-icons/tb';
import styles from './Callout.module.css';

export const CALLOUT_TYPE = 'Callout' as const;

const VARIANT_ICONS: Record<CalloutVariant, ReactNode> = {
  info: <TbInfoCircle size={18} />,
  warning: <TbAlertTriangle size={18} />,
  danger: <TbAlertOctagon size={18} />,
  success: <TbCircleCheck size={18} />,
  note: <TbNote size={18} />
};

const variantClass = (variant: CalloutVariant): string | undefined => {
  if (variant === 'warning') return styles.warning;
  if (variant === 'danger') return styles.danger;
  if (variant === 'success') return styles.success;
  if (variant === 'note') return styles.note;
  return styles.info;
};

const normalizeVariant = (variant?: string): CalloutVariant =>
  isCalloutVariant(variant) ? variant : 'info';

export const calloutMdxRule: MdxRuleDef<CalloutSlateElement, 'block'> = {
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
      type: getPluginType(options.editor!, CALLOUT_TYPE),
      variant: normalizeVariant(typeof attrs['variant'] === 'string' ? attrs['variant'] : undefined)
    };
  },
  serialize: (slateNode, options) => ({
    attributes: propsToAttributes({ variant: normalizeVariant(slateNode.variant) }),
    // convertNodesSerialize returns generic unist nodes; the mdast-mdx typings
    // don't narrow that to MdxJsxFlowElement's own child union, so this cast
    // is the one framework-seam assertion this rule needs (see AllowedPropKey
    // design notes in defineMdxComponent.ts).
    children: convertNodesSerialize(
      slateNode.children ?? [],
      options
    ) as MdMdxJsxFlowElement['children'],
    name: CALLOUT_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const CalloutEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<CalloutSlateElement>) => {
  const editor = useEditorRef();
  const variant = normalizeVariant(element.variant);

  const setVariant = (next: CalloutVariant) => {
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.setNodes({ variant: next }, { at: path });
  };

  return (
    <EditorBlock element={element} {...props}>
      <div className={`${styles.container} ${styles.editorContainer} ${variantClass(variant)}`}>
        <div className={styles.icon} contentEditable={false}>
          {VARIANT_ICONS[variant]}
        </div>
        <div className={styles.body}>
          {/*
            A native <select>, not a custom dropdown: like the caption block's
            textarea, native form controls are excluded from Slate's
            beforeinput interception, so this works inside a contentEditable
            region without blocking typing in the sibling rich-text children.
          */}
          <select
            contentEditable={false}
            className={styles.variantSelect}
            value={variant}
            onMouseDown={event => event.stopPropagation()}
            onChange={event => setVariant(event.target.value as CalloutVariant)}
          >
            {CALLOUT_VARIANTS.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {children}
        </div>
      </div>
    </EditorBlock>
  );
};
