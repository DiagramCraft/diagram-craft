import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbChartDonut } from 'react-icons/tb';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityChart } from './EntityChart';
import { EntityChartDialog } from './EntityChartDialog';
import type { EntityChartSlateElement } from './types';

export const ENTITY_CHART_TYPE = 'EntityChart' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

// biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
export const entityChartMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, ENTITY_CHART_TYPE),
      schema: readAttr(attrs, 'schema'),
      owner: readAttr(attrs, 'owner'),
      lifecycle: readAttr(attrs, 'lifecycle'),
      groupBy: readAttr(attrs, 'groupBy'),
      chartType: readAttr(attrs, 'type')
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: Plate mdx rule shape
  serialize: (slateNode: any) => ({
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

export const EntityChartEditable = ({ element, children, ...props }: PlateElementProps) => {
  const el = element as EntityChartSlateElement;
  const schema = el.schema ?? '';
  const owner = el.owner ?? '';
  const lifecycle = el.lifecycle ?? '';
  const groupBy = el.groupBy ?? '';
  const chartType = el.chartType ?? '';
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
