import { PlateElement, type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { EntityLink } from './EntityLink';
import { EntityLinkDialog } from './EntityLinkDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityLinkSlateElement } from './types';

export const ENTITY_LINK_TYPE = 'EntityLink' as const;

// ── MDX serialization rule ────────────────────────────────────────────────────

export const entityLinkMdxRule = defineLeafMdxRule<EntityLinkSlateElement, 'inline'>({
  name: ENTITY_LINK_TYPE,
  mode: 'inline',
  fields: [{ key: 'entityId', attr: 'id', required: true }]
});

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityLinkEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityLinkSlateElement>) => {
  const entityId = element.entityId ?? '';
  const isNew = !entityId;

  return (
    <PlateElement element={element} as="span" {...props}>
      <BaseInlineEditable
        hasValue={!!entityId}
        type={element.type}
        placeholder={<span>link…</span>}
        dialog={(open, onClose) => (
          <EntityLinkDialog element={element} open={open} onClose={onClose} isNew={isNew} />
        )}
      >
        <EntityLink id={entityId} />
      </BaseInlineEditable>
      {children}
    </PlateElement>
  );
};
