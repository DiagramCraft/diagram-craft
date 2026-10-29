import { PlateElement, type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../shared/mdx/leafMdxRule';
import { EntityMention } from './EntityMention';
import { EntityMentionDialog } from './EntityMentionDialog';
import { BaseInlineEditable } from '../../shared/mdx/BaseInlineEditable';
import type { EntityMentionSlateElement } from './types';

export const ENTITY_MENTION_TYPE = 'EntityMention' as const;

// ── MDX serialization rule ────────────────────────────────────────────────────

export const entityMentionMdxRule = defineLeafMdxRule<EntityMentionSlateElement, 'inline'>({
  name: ENTITY_MENTION_TYPE,
  mode: 'inline',
  fields: [{ key: 'entityId', attr: 'id', required: true }]
});

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
        type={element.type}
        placeholder={<span>mention…</span>}
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
