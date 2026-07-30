import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbListSearch } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import { EntityBrowserEmbedConfigForm } from './EntityBrowserEmbedConfigForm';
import {
  decodeEntityBrowserEmbedConfig,
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';
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

const emptyConfig = (context: { projectId?: string }): EntityBrowserEmbedConfig => ({
  q: '',
  conditions: [],
  sort: 'name',
  view: 'table',
  viewConfigs: {},
  projectScope: context.projectId ? 'project' : 'all'
});

export const entityBrowserEmbedMdxConfigSpec: MdxConfigSpec<
  EntityBrowserEmbedSlateElement,
  EntityBrowserEmbedConfig
> = {
  title: 'Entity browser',
  width: 'min(1200px, 92vw)',
  fromElement: el => decodeEntityBrowserEmbedConfig(el.config) ?? emptyConfig({}),
  toElement: config => ({ config: encodeEntityBrowserEmbedConfig(config) }),
  defaultConfig: emptyConfig,
  isValidConfig: () => true,
  ConfigForm: EntityBrowserEmbedConfigForm
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
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
          spec={entityBrowserEmbedMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
