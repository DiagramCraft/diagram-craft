import { PlateElement, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbAt } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EntityMention } from './EntityMention';
import { EntityMentionDialog } from './EntityMentionDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityMentionSlateElement } from './types';

export const ENTITY_MENTION_TYPE = 'EntityMention' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

// ── MDX serialization rule ────────────────────────────────────────────────────

export const entityMentionMdxRule: MdxRuleDef<EntityMentionSlateElement, 'inline'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_MENTION_TYPE),
      entityId: stringProp(attrs['id'])
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? ''
    }),
    children: [],
    name: ENTITY_MENTION_TYPE,
    type: 'mdxJsxTextElement'
  })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityMentionEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityMentionSlateElement>) => {
  const entityId = element.entityId ?? '';
  const isNew = !entityId;

  return (
    <PlateElement element={element} as="span" {...props}>
      <BaseInlineEditable
        hasValue={!!entityId}
        placeholder={<><TbAt size={12} /><span>mention…</span></>}
        dialog={(open, onClose) => (
          <EntityMentionDialog element={element} open={open} onClose={onClose} isNew={isNew} />
        )}
      >
        <EntityMention id={entityId} />
      </BaseInlineEditable>
      {children}
    </PlateElement>
  );
};
