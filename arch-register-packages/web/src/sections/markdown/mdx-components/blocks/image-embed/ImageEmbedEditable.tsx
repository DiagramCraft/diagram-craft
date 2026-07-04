import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbPhoto } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { ImageEmbed } from './ImageEmbed';
import { ImageEmbedDialog } from './ImageEmbedDialog';
import type { ImageEmbedSlateElement } from './types';

export const IMAGE_EMBED_TYPE = 'ImageEmbed' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

export const imageEmbedMdxRule: MdxRuleDef<ImageEmbedSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, IMAGE_EMBED_TYPE),
      fileId: stringProp(attrs['id']),
      alt: stringProp(attrs['alt']),
      size: stringProp(attrs['size']),
      align: stringProp(attrs['align'])
    };
  },
  serialize: slateNode => ({
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
