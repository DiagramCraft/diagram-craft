import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbId } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityCard } from './EntityCard';
import { EntityCardDialog } from './EntityCardDialog';
import type { EntityCardSlateElement } from './types';

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
      placeholder={<><TbId size={16} /><span>Choose entity…</span></>}
      content={<EntityCard id={entityId} fields={fields} />}
      dialog={(open, onClose) => (
        <EntityCardDialog element={element} open={open} onClose={onClose} isNew={isNew} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
