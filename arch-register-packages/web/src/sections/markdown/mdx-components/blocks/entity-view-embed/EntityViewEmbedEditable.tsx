import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
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
  toElement: config => ({ viewId: config.viewId }),
  isValidConfig: config => !!config.viewId
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
      placeholder={<span>Select a saved view…</span>}
      content={<MdxComponentPreview type={ENTITY_VIEW_EMBED_TYPE} props={{ viewId }} />}
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
