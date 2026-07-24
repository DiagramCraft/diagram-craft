import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbListSearch } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import { EntityBrowserEmbedDialog } from './EntityBrowserEmbedDialog';
import type { EntityBrowserEmbedSlateElement } from './types';

export const ENTITY_BROWSER_EMBED_TYPE = 'EntityBrowserEmbed' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const entityBrowserEmbedMdxRule: MdxRuleDef<EntityBrowserEmbedSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_BROWSER_EMBED_TYPE),
      config: readAttr(attrs, 'config')
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      ...(slateNode.config ? { config: slateNode.config } : {})
    }),
    children: [],
    name: ENTITY_BROWSER_EMBED_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const EntityBrowserEmbedEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityBrowserEmbedSlateElement>) => {
  const config = element.config ?? '';
  const hasValue = !!config;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={
        <>
          <TbListSearch size={16} />
          <span>Configure an entity browser…</span>
        </>
      }
      content={<EntityBrowserEmbed config={config === '' ? undefined : config} />}
      dialog={(open, onClose) => (
        <EntityBrowserEmbedDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
