import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { ConfigurableBlockEditable } from '../ConfigurableBlockEditable';
import type { MdxConfigSpec } from '../MdxWidgetConfigDialog';
import type { EntityCardSlateElement, EntityCardWidgetConfig } from './types';

export const ENTITY_CARD_TYPE = 'EntityCard' as const;

// ── MDX serialization rule (consumed by PlateMarkdownEditor) ─────────────────

export const entityCardMdxRule = defineLeafMdxRule<EntityCardSlateElement, 'block'>({
  name: ENTITY_CARD_TYPE,
  mode: 'block',
  fields: [{ key: 'entityId', attr: 'id', required: true }, { key: 'fields' }]
});

// ── Config editing ────────────────────────────────────────────────────────────

export const entityCardMdxConfigSpec: MdxConfigSpec<
  EntityCardSlateElement,
  EntityCardWidgetConfig
> = {
  width: 440,
  fromElement: el => ({ entityId: el.entityId ?? '', fields: el.fields }),
  toElement: config => ({ entityId: config.entityId, fields: config.fields })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityCardEditable = (props: PlateElementProps<EntityCardSlateElement>) => (
  <ConfigurableBlockEditable
    {...props}
    componentType={ENTITY_CARD_TYPE}
    placeholder="Choose entity…"
    configSpec={entityCardMdxConfigSpec}
    hasValue={el => !!el.entityId}
    previewProps={el => ({ id: el.entityId ?? '', fields: el.fields ?? '' })}
  />
);
