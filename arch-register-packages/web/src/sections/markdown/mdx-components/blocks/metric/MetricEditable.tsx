import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { readStringAttr } from '../../leafMdxRule';
import type { MdxRuleDef } from '../../types';
import { ConfigurableBlockEditable } from '../ConfigurableBlockEditable';
import type { MdxConfigSpec } from '../MdxWidgetConfigDialog';
import type { MetricSlateElement, StatMetricWidgetConfig } from './types';

export const METRIC_TYPE = 'Metric' as const;

export const metricMdxRule: MdxRuleDef<MetricSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    const metricType = readStringAttr(attrs, 'metricType');
    const showLink = readStringAttr(attrs, 'showLink');
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, METRIC_TYPE),
      schema: readStringAttr(attrs, 'schema'),
      owner: readStringAttr(attrs, 'owner'),
      lifecycle: readStringAttr(attrs, 'lifecycle'),
      label: readStringAttr(attrs, 'label'),
      ...(metricType ? { metricType: metricType as MetricSlateElement['metricType'] } : {}),
      ...(showLink !== '' ? { showLink: showLink !== 'false' } : {})
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      ...(slateNode.schema ? { schema: slateNode.schema } : {}),
      ...(slateNode.owner ? { owner: slateNode.owner } : {}),
      ...(slateNode.lifecycle ? { lifecycle: slateNode.lifecycle } : {}),
      ...(slateNode.label ? { label: slateNode.label } : {}),
      ...(slateNode.metricType ? { metricType: slateNode.metricType } : {}),
      ...(slateNode.showLink === false ? { showLink: 'false' } : {})
    }),
    children: [],
    name: METRIC_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const metricMdxConfigSpec: MdxConfigSpec<MetricSlateElement, StatMetricWidgetConfig> = {
  fromElement: el => ({
    metricType: el.metricType ?? 'entity-count',
    schema: el.schema,
    owner: el.owner,
    lifecycle: el.lifecycle,
    label: el.label,
    showLink: el.showLink
  }),
  toElement: config => ({
    schema: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? '',
    label: config.label ?? '',
    metricType: config.metricType,
    showLink: config.showLink
  })
};

export const MetricEditable = (props: PlateElementProps<MetricSlateElement>) => (
  <ConfigurableBlockEditable
    {...props}
    componentType={METRIC_TYPE}
    placeholder="Configure metric…"
    configSpec={metricMdxConfigSpec}
    hasValue={el => !!(el.schema || el.owner || el.lifecycle || el.label || el.metricType)}
    previewProps={el => ({
      schema: el.schema ?? '',
      owner: el.owner ?? '',
      lifecycle: el.lifecycle ?? '',
      label: el.label ?? '',
      metricType: el.metricType ?? '',
      showLink: el.showLink === undefined ? '' : String(el.showLink)
    })}
  />
);
