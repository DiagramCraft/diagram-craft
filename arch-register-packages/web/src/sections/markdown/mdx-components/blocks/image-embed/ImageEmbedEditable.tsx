import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbPhoto } from 'react-icons/tb';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { ImageEmbed } from './ImageEmbed';
import { ImageEmbedDialog } from './ImageEmbedDialog';
import type { ImageEmbedSlateElement } from './types';

export const IMAGE_EMBED_TYPE = 'ImageEmbed' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

// biome-ignore lint/suspicious/noExplicitAny: ok
export const imageEmbedMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: ok
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, IMAGE_EMBED_TYPE),
      fileId: stringProp(attrs['id']),
      alt: stringProp(attrs['alt']),
      size: stringProp(attrs['size']),
      align: stringProp(attrs['align'])
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: ok
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      id: slateNode.fileId ?? '',
      ...(slateNode.alt ? { alt: slateNode.alt } : {}),
      ...(slateNode.size ? { size: slateNode.size } : {}),
      ...(slateNode.align ? { align: slateNode.align } : {})
    }),
    children: [],
    name: IMAGE_EMBED_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const ImageEmbedEditable = ({ element, children, ...props }: PlateElementProps) => {
  const el = element as ImageEmbedSlateElement;
  const fileId = el.fileId ?? '';
  const alt = el.alt ?? '';
  const size = el.size ?? '';
  const align = el.align ?? 'center';
  const isNew = !fileId;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={!!fileId}
      placeholder={<><TbPhoto size={16} /><span>Choose image…</span></>}
      content={
        <ImageEmbed
          id={fileId}
          alt={alt || undefined}
          size={size || undefined}
          align={align || undefined}
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
