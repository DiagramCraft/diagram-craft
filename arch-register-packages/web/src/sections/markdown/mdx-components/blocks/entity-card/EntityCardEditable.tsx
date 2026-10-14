import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import type { MdxRuleDef } from '../../types';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
import type { EntityCardSlateElement, EntityCardWidgetConfig } from './types';

export const ENTITY_CARD_TYPE = 'EntityCard' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

// ── MDX serialization rule (consumed by PlateMarkdownEditor) ─────────────────

export const entityCardMdxRule: MdxRuleDef<EntityCardSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_CARD_TYPE),
      entityId: stringProp(attrs['id']),
      fields: stringProp(attrs['fields'])
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? '',
      ...(slateNode.fields ? { fields: slateNode.fields } : {})
    }),
    children: [],
    name: ENTITY_CARD_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

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
