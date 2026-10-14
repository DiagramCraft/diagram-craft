import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbHash } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
import type { MetricSlateElement, StatMetricWidgetConfig } from './types';

export const METRIC_TYPE = 'Metric' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const metricMdxRule: MdxRuleDef<MetricSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    const metricType = readAttr(attrs, 'metricType');
    const showLink = readAttr(attrs, 'showLink');
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, METRIC_TYPE),
      schema: readAttr(attrs, 'schema'),
      owner: readAttr(attrs, 'owner'),
      lifecycle: readAttr(attrs, 'lifecycle'),
      label: readAttr(attrs, 'label'),
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
  width: 460,
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
  }),
  isValidConfig: () => true
};

export const MetricEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<MetricSlateElement>) => {
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const label = element.label ?? '';
  const metricType = element.metricType;
  const hasValue = !!(schema || owner || lifecycle || label || metricType);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      placeholder={
        <>
          <TbHash size={16} />
          <span>Configure metric…</span>
        </>
      }
      content={
        <MdxComponentPreview
          type={METRIC_TYPE}
          props={{
            schema,
            owner,
            lifecycle,
            label,
            metricType: metricType ?? '',
            showLink: element.showLink === undefined ? '' : String(element.showLink)
          }}
        />
      }
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
          spec={metricMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
