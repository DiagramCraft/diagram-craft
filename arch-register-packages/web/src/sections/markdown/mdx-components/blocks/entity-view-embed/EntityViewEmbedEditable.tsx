import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { ConfigurableBlockEditable } from '../ConfigurableBlockEditable';
import type { MdxConfigSpec } from '../MdxWidgetConfigDialog';
import type { EntityViewEmbedSlateElement, SavedViewEmbedWidgetConfig } from './types';

export const ENTITY_VIEW_EMBED_TYPE = 'EntityViewEmbed' as const;

export const entityViewEmbedMdxRule = defineLeafMdxRule<EntityViewEmbedSlateElement, 'block'>({
  name: ENTITY_VIEW_EMBED_TYPE,
  mode: 'block',
  fields: [{ key: 'viewId' }]
});

export const entityViewEmbedMdxConfigSpec: MdxConfigSpec<
  EntityViewEmbedSlateElement,
  SavedViewEmbedWidgetConfig
> = {
  width: 460,
  fromElement: el => ({ viewId: el.viewId ?? '' }),
  toElement: config => ({ viewId: config.viewId })
};

export const EntityViewEmbedEditable = (props: PlateElementProps<EntityViewEmbedSlateElement>) => (
  <ConfigurableBlockEditable
    {...props}
    componentType={ENTITY_VIEW_EMBED_TYPE}
    placeholder="Select a saved view…"
    fullWidth
    configSpec={entityViewEmbedMdxConfigSpec}
    hasValue={el => !!el.viewId}
    previewProps={el => ({ viewId: el.viewId ?? '' })}
  />
);
