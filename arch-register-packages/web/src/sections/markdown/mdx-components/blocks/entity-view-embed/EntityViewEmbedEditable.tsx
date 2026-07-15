import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbLayoutGrid } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityViewEmbed } from './EntityViewEmbed';
import { EntityViewEmbedDialog } from './EntityViewEmbedDialog';
import type { EntityViewEmbedSlateElement } from './types';

export const ENTITY_VIEW_EMBED_TYPE = 'EntityViewEmbed' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const entityViewEmbedMdxRule: MdxRuleDef<EntityViewEmbedSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_VIEW_EMBED_TYPE),
      viewId: readAttr(attrs, 'viewId')
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      ...(slateNode.viewId ? { viewId: slateNode.viewId } : {})
    }),
    children: [],
    name: ENTITY_VIEW_EMBED_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const EntityViewEmbedEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityViewEmbedSlateElement>) => {
  const viewId = element.viewId ?? '';
  const hasValue = !!viewId;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={
        <>
          <TbLayoutGrid size={16} />
          <span>Select a saved view…</span>
        </>
      }
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
