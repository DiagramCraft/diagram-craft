import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbChartLine } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { DiagramEmbed } from './DiagramEmbed';
import { DiagramEmbedDialog } from './DiagramEmbedDialog';
import type { DiagramEmbedSlateElement } from './types';

export const DIAGRAM_EMBED_TYPE = 'DiagramEmbed' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

export const diagramEmbedMdxRule: MdxRuleDef<DiagramEmbedSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, DIAGRAM_EMBED_TYPE),
      fileId: stringProp(attrs['id']),
      caption: stringProp(attrs['caption'])
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      id: slateNode.fileId ?? '',
      ...(slateNode.caption ? { caption: slateNode.caption } : {})
    }),
    children: [],
    name: DIAGRAM_EMBED_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const DiagramEmbedEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<DiagramEmbedSlateElement>) => {
  const fileId = element.fileId ?? '';
  const caption = element.caption ?? '';
  const isNew = !fileId;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={!!fileId}
      placeholder={<><TbChartLine size={16} /><span>Choose diagram…</span></>}
      content={<DiagramEmbed id={fileId} caption={caption || undefined} />}
      dialog={(open, onClose) => (
        <DiagramEmbedDialog element={element} open={open} onClose={onClose} isNew={isNew} />
      )}
      fullWidth
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
