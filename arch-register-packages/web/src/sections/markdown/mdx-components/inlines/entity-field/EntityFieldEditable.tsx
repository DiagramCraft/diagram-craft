import { PlateElement, type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { EntityField } from './EntityField';
import { EntityFieldDialog } from './EntityFieldDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityFieldSlateElement } from './types';

export const ENTITY_FIELD_TYPE = 'EntityField' as const;

// ── MDX serialization rule ────────────────────────────────────────────────────

export const entityFieldMdxRule = defineLeafMdxRule<EntityFieldSlateElement, 'inline'>({
  name: ENTITY_FIELD_TYPE,
  mode: 'inline',
  fields: [
    { key: 'entityId', attr: 'id', required: true },
    { key: 'field', required: true }
  ]
});

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityFieldEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityFieldSlateElement>) => {
  const entityId = element.entityId ?? '';
  const field = element.field ?? '';
  const isNew = !entityId;

  return (
    <PlateElement element={element} as="span" {...props}>
      <BaseInlineEditable
        hasValue={!!(entityId && field)}
        type={element.type}
        placeholder={<span>field…</span>}
        dialog={(open, onClose) => (
          <EntityFieldDialog element={element} open={open} onClose={onClose} isNew={isNew} />
        )}
      >
        <EntityField id={entityId} field={field} />
      </BaseInlineEditable>
      {children}
    </PlateElement>
  );
};
