import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { ImageEmbed } from './ImageEmbed';
import { ImageEmbedDialog } from './ImageEmbedDialog';
import type { ImageEmbedSlateElement } from './types';

export const IMAGE_EMBED_TYPE = 'ImageEmbed' as const;

export const imageEmbedMdxRule = defineLeafMdxRule<ImageEmbedSlateElement, 'block'>({
  name: IMAGE_EMBED_TYPE,
  mode: 'block',
  fields: [
    { key: 'fileId', attr: 'id', required: true },
    { key: 'alt' },
    { key: 'size' },
    { key: 'align' }
  ]
});

export const ImageEmbedEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<ImageEmbedSlateElement>) => {
  const fileId = element.fileId ?? '';
  const alt = element.alt ?? '';
  const size = element.size ?? '';
  const align = element.align ?? 'center';
  const isNew = !fileId;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={!!fileId}
      placeholder={<span>Choose image…</span>}
      content={
        <ImageEmbed
          id={fileId}
          alt={alt ?? undefined}
          size={size ?? undefined}
          align={align ?? undefined}
        />
      }
      dialog={(open, onClose) => (
        <ImageEmbedDialog element={element} open={open} onClose={onClose} isNew={isNew} />
      )}
      fullWidth
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
