import { PlateElement, type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../shared/mdx/leafMdxRule';
import { Label } from './Label';
import { LabelDialog } from './LabelDialog';
import { BaseInlineEditable } from '../../shared/mdx/BaseInlineEditable';
import type { LabelSlateElement } from './types';

export const LABEL_TYPE = 'Label' as const;

// ── MDX serialization rule ────────────────────────────────────────────────────

export const labelMdxRule = defineLeafMdxRule<LabelSlateElement, 'inline'>({
  name: LABEL_TYPE,
  mode: 'inline',
  fields: [
    { key: 'content', attr: 'text', required: true },
    { key: 'color', required: true }
  ]
});

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
