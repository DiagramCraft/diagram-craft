import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbLayoutGrid } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { EntityViewEmbed } from './EntityViewEmbed';
import { EntityViewEmbedConfigForm } from './EntityViewEmbedConfigForm';
import type { EntityViewEmbedSlateElement, SavedViewEmbedWidgetConfig } from './types';

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

export const entityViewEmbedMdxConfigSpec: MdxConfigSpec<
  EntityViewEmbedSlateElement,
  SavedViewEmbedWidgetConfig
> = {
  title: 'Entity view',
  width: 460,
  fromElement: el => ({ viewId: el.viewId ?? '' }),
  toElement: config => ({ viewId: config.viewId }),
  defaultConfig: () => ({ viewId: '' }),
  isValidConfig: config => !!config.viewId,
  ConfigForm: EntityViewEmbedConfigForm
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
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
          spec={entityViewEmbedMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
