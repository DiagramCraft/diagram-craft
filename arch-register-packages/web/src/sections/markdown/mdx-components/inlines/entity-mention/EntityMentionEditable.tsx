import { PlateElement, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbAt } from 'react-icons/tb';
import { EntityMention } from './EntityMention';
import { EntityMentionDialog } from './EntityMentionDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityMentionSlateElement } from './types';

export const ENTITY_MENTION_TYPE = 'EntityMention' as const;

// ── MDX serialization rule ────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: MDX plugin API requires flexible typing
export const entityMentionMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: Plate.js internal types are not exported
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, ENTITY_MENTION_TYPE),
      entityId: attrs['id'] ?? ''
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: Slate node structure is dynamic
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? ''
    }),
    children: [],
    name: ENTITY_MENTION_TYPE,
    type: 'mdxJsxTextElement'
  })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityMentionEditable = ({ element, children, ...props }: PlateElementProps) => {
  const entityId = (element as EntityMentionSlateElement).entityId ?? '';
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
