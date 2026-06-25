import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbTable } from 'react-icons/tb';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityTable } from './EntityTable';
import { EntityTableDialog } from './EntityTableDialog';
import type { EntityTableSlateElement } from './types';

export const ENTITY_TABLE_TYPE = 'EntityTable' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

// biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
export const entityTableMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, ENTITY_TABLE_TYPE),
      schema: readAttr(attrs, 'schema'),
      owner: readAttr(attrs, 'owner'),
      lifecycle: readAttr(attrs, 'lifecycle'),
      limit: readAttr(attrs, 'limit')
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      ...(slateNode.schema ? { schema: slateNode.schema } : {}),
      ...(slateNode.owner ? { owner: slateNode.owner } : {}),
      ...(slateNode.lifecycle ? { lifecycle: slateNode.lifecycle } : {}),
      ...(slateNode.limit ? { limit: slateNode.limit } : {})
    }),
    children: [],
    name: ENTITY_TABLE_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const EntityTableEditable = ({ element, children, ...props }: PlateElementProps) => {
  const el = element as EntityTableSlateElement;
  const schema = el.schema ?? '';
  const owner = el.owner ?? '';
  const lifecycle = el.lifecycle ?? '';
  const limit = el.limit ?? '';
  const hasValue = !!(schema || owner || lifecycle);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={<><TbTable size={16} /><span>Configure entity table…</span></>}
      content={
        <EntityTable
          schema={schema === '' ? undefined : schema}
          owner={owner === '' ? undefined : owner}
          lifecycle={lifecycle === '' ? undefined : lifecycle}
          limit={limit === '' ? undefined : limit}
        />
      }
      dialog={(open, onClose) => (
        <EntityTableDialog element={element} open={open} onClose={onClose} isNew={!hasValue} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
