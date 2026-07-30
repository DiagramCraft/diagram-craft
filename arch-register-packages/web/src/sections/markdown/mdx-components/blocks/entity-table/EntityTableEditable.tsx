import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbTable } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { EntityTable } from './EntityTable';
import { EntityTableConfigForm } from './EntityTableConfigForm';
import type { EntityTableSlateElement, EntityTableWidgetConfig } from './types';

export const ENTITY_TABLE_TYPE = 'EntityTable' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const entityTableMdxRule: MdxRuleDef<EntityTableSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_TABLE_TYPE),
      schema: readAttr(attrs, 'schema'),
      owner: readAttr(attrs, 'owner'),
      lifecycle: readAttr(attrs, 'lifecycle'),
      limit: readAttr(attrs, 'limit')
    };
  },
  serialize: slateNode => ({
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

export const entityTableMdxConfigSpec: MdxConfigSpec<
  EntityTableSlateElement,
  EntityTableWidgetConfig
> = {
  title: 'Entity table',
  width: 460,
  fromElement: el => ({
    schema: el.schema,
    owner: el.owner,
    lifecycle: el.lifecycle,
    limit: el.limit ? Number(el.limit) : undefined
  }),
  toElement: config => ({
    schema: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? '',
    limit: String(config.limit ?? 10)
  }),
  defaultConfig: () => ({}),
  isValidConfig: () => true,
  ConfigForm: EntityTableConfigForm
};

export const EntityTableEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityTableSlateElement>) => {
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const limit = element.limit ?? '';
  const hasValue = !!(schema || owner || lifecycle);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={
        <>
          <TbTable size={16} />
          <span>Configure entity table…</span>
        </>
      }
      content={
        <EntityTable
          schema={schema === '' ? undefined : schema}
          owner={owner === '' ? undefined : owner}
          lifecycle={lifecycle === '' ? undefined : lifecycle}
          limit={limit === '' ? undefined : limit}
        />
      }
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
          spec={entityTableMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
