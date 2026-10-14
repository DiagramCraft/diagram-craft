import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
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
  toElement: config => ({ entityId: config.entityId, fields: config.fields }),
  isValidConfig: config => !!config.entityId
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityCardEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityCardSlateElement>) => {
  const entityId = element.entityId ?? '';
  const fields = element.fields ?? '';
  const isNew = !entityId;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={!!entityId}
      placeholder={<span>Choose entity…</span>}
      content={<MdxComponentPreview type={ENTITY_CARD_TYPE} props={{ id: entityId, fields }} />}
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={isNew}
          spec={entityCardMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
