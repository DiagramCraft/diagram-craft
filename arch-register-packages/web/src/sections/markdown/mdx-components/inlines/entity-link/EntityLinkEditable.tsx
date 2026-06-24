import { PlateElement, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbLink } from 'react-icons/tb';
import { EntityLink } from './EntityLink';
import { EntityLinkDialog } from './EntityLinkDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityLinkSlateElement } from './types';

export const ENTITY_LINK_TYPE = 'EntityLink' as const;

// ── MDX serialization rule ────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: MDX plugin API requires flexible typing
export const entityLinkMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: Plate.js internal types are not exported
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, ENTITY_LINK_TYPE),
      entityId: attrs['id'] ?? ''
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: Slate node structure is dynamic
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? ''
    }),
    children: [],
    name: ENTITY_LINK_TYPE,
    type: 'mdxJsxTextElement'
  })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityLinkEditable = ({ element, children, ...props }: PlateElementProps) => {
  const entityId = (element as EntityLinkSlateElement).entityId ?? '';
  const isNew = !entityId;

  return (
    <PlateElement element={element} as="span" {...props}>
      <BaseInlineEditable
        hasValue={!!entityId}
        placeholder={<><TbLink size={12} /><span>link…</span></>}
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
