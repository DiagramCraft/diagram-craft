import { PlateElement, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import type { MdxRuleDef } from '../../types';
import { Label } from './Label';
import { LabelDialog } from './LabelDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { LabelSlateElement } from './types';

export const LABEL_TYPE = 'Label' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

// ── MDX serialization rule ────────────────────────────────────────────────────

export const labelMdxRule: MdxRuleDef<LabelSlateElement, 'inline'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, LABEL_TYPE),
      content: stringProp(attrs['text']),
      color: stringProp(attrs['color'])
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      text: slateNode.content ?? '',
      color: slateNode.color ?? ''
    }),
    children: [],
    name: LABEL_TYPE,
    type: 'mdxJsxTextElement'
  })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const LabelEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<LabelSlateElement>) => {
  const text = element.content ?? '';
  const color = element.color ?? '';
  const isNew = !text;

  return (
    <PlateElement element={element} as="span" {...props}>
      <BaseInlineEditable
        hasValue={!!text}
        type={element.type}
        placeholder={<span>label…</span>}
        dialog={(open, onClose) => (
          <LabelDialog element={element} open={open} onClose={onClose} isNew={isNew} />
        )}
      >
        <Label text={text} color={color} />
      </BaseInlineEditable>
      {children}
    </PlateElement>
  );
};
