import { PlateElement, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbLink } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EntityLink } from './EntityLink';
import { EntityLinkDialog } from './EntityLinkDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityLinkSlateElement } from './types';

export const ENTITY_LINK_TYPE = 'EntityLink' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

// ── MDX serialization rule ────────────────────────────────────────────────────

export const entityLinkMdxRule: MdxRuleDef<EntityLinkSlateElement, 'inline'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_LINK_TYPE),
      entityId: stringProp(attrs['id'])
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? ''
    }),
    children: [],
    name: ENTITY_LINK_TYPE,
    type: 'mdxJsxTextElement'
  })
};

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
        placeholder={
          <>
            <TbLink size={12} />
            <span>link…</span>
          </>
        }
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
