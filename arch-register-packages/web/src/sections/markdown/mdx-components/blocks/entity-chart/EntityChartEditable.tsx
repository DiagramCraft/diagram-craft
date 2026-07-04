import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbChartDonut } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityChart } from './EntityChart';
import { EntityChartDialog } from './EntityChartDialog';
import type { EntityChartSlateElement } from './types';

export const ENTITY_CHART_TYPE = 'EntityChart' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const entityChartMdxRule: MdxRuleDef<EntityChartSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_CHART_TYPE),
      schema: readAttr(attrs, 'schema'),
      owner: readAttr(attrs, 'owner'),
      lifecycle: readAttr(attrs, 'lifecycle'),
      groupBy: readAttr(attrs, 'groupBy'),
      chartType: readAttr(attrs, 'type')
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      ...(slateNode.schema ? { schema: slateNode.schema } : {}),
      ...(slateNode.owner ? { owner: slateNode.owner } : {}),
      ...(slateNode.lifecycle ? { lifecycle: slateNode.lifecycle } : {}),
      ...(slateNode.groupBy && slateNode.groupBy !== 'lifecycle' ? { groupBy: slateNode.groupBy } : {}),
      ...(slateNode.chartType && slateNode.chartType !== 'donut' ? { type: slateNode.chartType } : {})
    }),
    children: [],
    name: ENTITY_CHART_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const EntityChartEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityChartSlateElement>) => {
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const groupBy = element.groupBy ?? '';
  const chartType = element.chartType ?? '';
  const hasValue = !!(schema || owner || lifecycle);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      placeholder={<><TbChartDonut size={16} /><span>Configure entity chart…</span></>}
      content={
        <EntityChart
          schema={schema === '' ? undefined : schema}
          owner={owner === '' ? undefined : owner}
          lifecycle={lifecycle === '' ? undefined : lifecycle}
          groupBy={groupBy === '' ? undefined : groupBy}
          chartType={chartType === '' ? undefined : chartType}
        />
      }
      dialog={(open, onClose) => (
        <EntityChartDialog element={element} open={open} onClose={onClose} isNew={!hasValue} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
