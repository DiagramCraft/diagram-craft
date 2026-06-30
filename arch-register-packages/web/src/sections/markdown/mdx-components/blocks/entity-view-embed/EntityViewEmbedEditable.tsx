import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbLayoutGrid } from 'react-icons/tb';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityViewEmbed } from './EntityViewEmbed';
import { EntityViewEmbedDialog } from './EntityViewEmbedDialog';
import type { EntityViewEmbedSlateElement } from './types';

export const ENTITY_VIEW_EMBED_TYPE = 'EntityViewEmbed' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

// biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
export const entityViewEmbedMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, ENTITY_VIEW_EMBED_TYPE),
      viewId: readAttr(attrs, 'viewId')
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      ...(slateNode.viewId ? { viewId: slateNode.viewId } : {})
    }),
    children: [],
    name: ENTITY_VIEW_EMBED_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const EntityViewEmbedEditable = ({ element, children, ...props }: PlateElementProps) => {
  const el = element as EntityViewEmbedSlateElement;
  const viewId = el.viewId ?? '';
  const hasValue = !!viewId;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={<><TbLayoutGrid size={16} /><span>Select a saved view…</span></>}
      content={<EntityViewEmbed viewId={viewId === '' ? undefined : viewId} />}
      dialog={(open, onClose) => (
        <EntityViewEmbedDialog element={element} open={open} onClose={onClose} isNew={!hasValue} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
