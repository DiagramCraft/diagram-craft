import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbHistory } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityChangelog } from './EntityChangelog';
import { EntityChangelogDialog } from './EntityChangelogDialog';
import type { EntityChangelogSlateElement } from './types';

export const ENTITY_CHANGELOG_TYPE = 'EntityChangelog' as const;

const stringProp = (value: unknown) => (value == null ? '' : String(value));

export const entityChangelogMdxRule: MdxRuleDef<EntityChangelogSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_CHANGELOG_TYPE),
      entityId: stringProp(attrs['id']),
      schema: stringProp(attrs['schema']),
      owner: stringProp(attrs['owner']),
      lifecycle: stringProp(attrs['lifecycle']),
      limit: stringProp(attrs['limit']),
      since: stringProp(attrs['since'])
    };
  },
  serialize: slateNode => ({
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

export const EntityChangelogEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityChangelogSlateElement>) => {
  const entityId = element.entityId ?? '';
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const limit = element.limit ?? '';
  const since = element.since ?? '';

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
