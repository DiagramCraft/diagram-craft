import { PlateElement, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbHash } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EntityField } from './EntityField';
import { EntityFieldDialog } from './EntityFieldDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityFieldSlateElement } from './types';

export const ENTITY_FIELD_TYPE = 'EntityField' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

// ── MDX serialization rule ────────────────────────────────────────────────────

export const entityFieldMdxRule: MdxRuleDef<EntityFieldSlateElement, 'inline'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_FIELD_TYPE),
      entityId: stringProp(attrs['id']),
      field: stringProp(attrs['field'])
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? '',
      field: slateNode.field ?? ''
    }),
    children: [],
    name: ENTITY_FIELD_TYPE,
    type: 'mdxJsxTextElement'
  })
};

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
        placeholder={
          <>
            <TbHash size={12} />
            <span>field…</span>
          </>
        }
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
