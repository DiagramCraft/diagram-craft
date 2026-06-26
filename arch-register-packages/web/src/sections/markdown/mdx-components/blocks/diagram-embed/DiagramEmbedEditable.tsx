import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbChartLine } from 'react-icons/tb';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { DiagramEmbed } from './DiagramEmbed';
import { DiagramEmbedDialog } from './DiagramEmbedDialog';
import type { DiagramEmbedSlateElement } from './types';

export const DIAGRAM_EMBED_TYPE = 'DiagramEmbed' as const;

// biome-ignore lint/suspicious/noExplicitAny: ok
export const diagramEmbedMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: ok
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, DIAGRAM_EMBED_TYPE),
      fileId: attrs['id'] ?? '',
      caption: attrs['caption'] ?? ''
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: ok
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      id: slateNode.fileId ?? '',
      ...(slateNode.caption ? { caption: slateNode.caption } : {})
    }),
    children: [],
    name: DIAGRAM_EMBED_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const DiagramEmbedEditable = ({ element, children, ...props }: PlateElementProps) => {
  const el = element as DiagramEmbedSlateElement;
  const fileId = el.fileId ?? '';
  const caption = el.caption ?? '';
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
