import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
import type { ComponentDefinition } from '../../componentRegistry';
import {
  createDefaultEntityBrowserEmbedConfig,
  decodeEntityBrowserEmbedConfig,
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';
import type { EntityBrowserEmbedSlateElement } from './types';

export const ENTITY_BROWSER_EMBED_TYPE = 'EntityBrowserEmbed' as const;

export const entityBrowserEmbedMdxRule = defineLeafMdxRule<EntityBrowserEmbedSlateElement, 'block'>(
  {
    name: ENTITY_BROWSER_EMBED_TYPE,
    mode: 'block',
    fields: [{ key: 'config' }]
  }
);

const emptyConfig = (
  context: { projectId?: string },
  definition: ComponentDefinition | undefined
): EntityBrowserEmbedConfig => {
  const defaultConfig = definition?.createDefaultProps?.({}).config as
    | EntityBrowserEmbedConfig
    | undefined;

  return {
    ...(defaultConfig ?? createDefaultEntityBrowserEmbedConfig()),
    projectScope: context.projectId ? 'project' : 'all'
  };
};

export const entityBrowserEmbedMdxConfigSpec: MdxConfigSpec<
  EntityBrowserEmbedSlateElement,
  EntityBrowserEmbedConfig
> = {
  width: 'min(1200px, 92vw)',
  fromElement: (el, definition) =>
    decodeEntityBrowserEmbedConfig(
      el.config,
      definition?.createDefaultProps?.({}).config as EntityBrowserEmbedConfig | undefined
    ) ?? emptyConfig({}, definition),
  toElement: config => ({ config: encodeEntityBrowserEmbedConfig(config) }),
  defaultConfig: (context, definition) => emptyConfig(context, definition)
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
      placeholder={<span>Configure an entity browser…</span>}
      content={<MdxComponentPreview type={ENTITY_BROWSER_EMBED_TYPE} props={{ config }} />}
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
