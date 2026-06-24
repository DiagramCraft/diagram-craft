import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbHistory } from 'react-icons/tb';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityChangelog } from './EntityChangelog';
import { EntityChangelogDialog } from './EntityChangelogDialog';
import type { EntityChangelogSlateElement } from './types';

export const ENTITY_CHANGELOG_TYPE = 'EntityChangelog' as const;

// biome-ignore lint/suspicious/noExplicitAny: ok
export const entityChangelogMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: ok
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, ENTITY_CHANGELOG_TYPE),
      entityId: attrs['id'] ?? '',
      schema: attrs['schema'] ?? '',
      owner: attrs['owner'] ?? '',
      lifecycle: attrs['lifecycle'] ?? '',
      limit: attrs['limit'] ?? '',
      since: attrs['since'] ?? ''
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: ok
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      ...(slateNode.entityId ? { id: slateNode.entityId } : {}),
      ...(slateNode.schema ? { schema: slateNode.schema } : {}),
      ...(slateNode.owner ? { owner: slateNode.owner } : {}),
      ...(slateNode.lifecycle ? { lifecycle: slateNode.lifecycle } : {}),
      ...(slateNode.limit ? { limit: slateNode.limit } : {}),
      ...(slateNode.since ? { since: slateNode.since } : {})
    }),
    children: [],
    name: ENTITY_CHANGELOG_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const EntityChangelogEditable = ({ element, children, ...props }: PlateElementProps) => {
  const el = element as EntityChangelogSlateElement;
  const entityId = el.entityId ?? '';
  const schema = el.schema ?? '';
  const owner = el.owner ?? '';
  const lifecycle = el.lifecycle ?? '';
  const limit = el.limit ?? '';
  const since = el.since ?? '';

  const hasValue = !!(entityId || schema || owner || lifecycle);
  const isNew = !hasValue;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={<><TbHistory size={16} /><span>Configure entity changelog…</span></>}
      content={
        <EntityChangelog
          id={entityId || undefined}
          schema={schema || undefined}
          owner={owner || undefined}
          lifecycle={lifecycle || undefined}
          limit={limit || undefined}
          since={since || undefined}
        />
      }
      dialog={(open, onClose) => (
        <EntityChangelogDialog element={element} open={open} onClose={onClose} isNew={isNew} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
