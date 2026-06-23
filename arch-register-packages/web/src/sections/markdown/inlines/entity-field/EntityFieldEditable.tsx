import { useState } from 'react';
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbHash } from 'react-icons/tb';
import { EntityField } from './EntityField';
import { EntityFieldDialog } from './EntityFieldDialog';
import { BaseInlineEditable } from '../BaseInlineEditable';
import type { EntityFieldSlateElement } from './types';

// ── MDX serialization rule ────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: MDX plugin API requires flexible typing
export const entityFieldMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: Plate.js internal types are not exported
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, 'EntityField'),
      entityId: attrs['id'] ?? '',
      field: attrs['field'] ?? ''
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: Slate node structure is dynamic
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? '',
      field: slateNode.field ?? ''
    }),
    children: [],
    name: 'EntityField',
    type: 'mdxJsxTextElement'
  })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityFieldEditable = ({ element, children, ...props }: PlateElementProps) => {
  const entityId = (element as EntityFieldSlateElement).entityId ?? '';
  const field = (element as EntityFieldSlateElement).field ?? '';
  const [dialogOpen, setDialogOpen] = useState(() => !entityId);
  const isNew = !entityId;

  return (
    <PlateElement element={element} as="span" {...props}>
      <BaseInlineEditable
        onEdit={() => setDialogOpen(true)}
        hasValue={!!(entityId && field)}
        placeholder={
          <>
            <TbHash size={12} />
            <span>field…</span>
          </>
        }
      >
        <EntityField id={entityId} field={field} />
      </BaseInlineEditable>
      {children}
      {dialogOpen && (
        <EntityFieldDialog
          element={element}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          isNew={isNew}
        />
      )}
    </PlateElement>
  );
};
