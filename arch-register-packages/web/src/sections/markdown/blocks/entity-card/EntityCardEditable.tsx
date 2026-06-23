import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbId } from 'react-icons/tb';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityCard } from './EntityCard';
import { EntityCardDialog } from './EntityCardDialog';
import type { EntityCardSlateElement } from './types';

// ── MDX serialization rule (consumed by PlateMarkdownEditor) ─────────────────

// biome-ignore lint/suspicious/noExplicitAny: ok
export const entityCardMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: ok
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, 'EntityCard'),
      entityId: attrs['id'] ?? '',
      fields: attrs['fields'] ?? ''
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: ok
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? '',
      ...(slateNode.fields ? { fields: slateNode.fields } : {})
    }),
    children: [],
    name: 'EntityCard',
    type: 'mdxJsxFlowElement'
  })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityCardEditable = ({ element, children, ...props }: PlateElementProps) => {
  const entityId = (element as EntityCardSlateElement).entityId ?? '';
  const fields = (element as EntityCardSlateElement).fields ?? '';
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
