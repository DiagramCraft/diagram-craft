import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbHash } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityMetric } from './EntityMetric';
import { EntityMetricDialog } from './EntityMetricDialog';
import type { EntityMetricSlateElement } from './types';

export const ENTITY_METRIC_TYPE = 'EntityMetric' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const entityMetricMdxRule: MdxRuleDef<EntityMetricSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_METRIC_TYPE),
      schema: readAttr(attrs, 'schema'),
      owner: readAttr(attrs, 'owner'),
      lifecycle: readAttr(attrs, 'lifecycle'),
      label: readAttr(attrs, 'label')
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      ...(slateNode.schema ? { schema: slateNode.schema } : {}),
      ...(slateNode.owner ? { owner: slateNode.owner } : {}),
      ...(slateNode.lifecycle ? { lifecycle: slateNode.lifecycle } : {}),
      ...(slateNode.label ? { label: slateNode.label } : {})
    }),
    children: [],
    name: ENTITY_METRIC_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const EntityMetricEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityMetricSlateElement>) => {
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const label = element.label ?? '';
  const hasValue = !!(schema || owner || lifecycle);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      placeholder={
        <>
          <TbHash size={16} />
          <span>Configure entity metric…</span>
        </>
      }
      content={
        <EntityMetric
          schema={schema === '' ? undefined : schema}
          owner={owner === '' ? undefined : owner}
          lifecycle={lifecycle === '' ? undefined : lifecycle}
          label={label === '' ? undefined : label}
        />
      }
      dialog={(open, onClose) => (
        <EntityMetricDialog element={element} open={open} onClose={onClose} isNew={!hasValue} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
