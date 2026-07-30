import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbHash } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { EntityMetric } from './EntityMetric';
import { EntityMetricConfigForm } from './EntityMetricConfigForm';
import type { EntityMetricSlateElement, StatMetricWidgetConfig } from './types';

export const ENTITY_METRIC_TYPE = 'EntityMetric' as const;

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const entityMetricMdxRule: MdxRuleDef<EntityMetricSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    const metricType = readAttr(attrs, 'metricType');
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_METRIC_TYPE),
      schema: readAttr(attrs, 'schema'),
      owner: readAttr(attrs, 'owner'),
      lifecycle: readAttr(attrs, 'lifecycle'),
      label: readAttr(attrs, 'label'),
      ...(metricType ? { metricType: metricType as EntityMetricSlateElement['metricType'] } : {})
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      ...(slateNode.schema ? { schema: slateNode.schema } : {}),
      ...(slateNode.owner ? { owner: slateNode.owner } : {}),
      ...(slateNode.lifecycle ? { lifecycle: slateNode.lifecycle } : {}),
      ...(slateNode.label ? { label: slateNode.label } : {}),
      ...(slateNode.metricType ? { metricType: slateNode.metricType } : {})
    }),
    children: [],
    name: ENTITY_METRIC_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const entityMetricMdxConfigSpec: MdxConfigSpec<
  EntityMetricSlateElement,
  StatMetricWidgetConfig
> = {
  title: 'Entity metric',
  width: 460,
  fromElement: el => ({
    metricType: el.metricType ?? 'entity-count',
    schema: el.schema,
    owner: el.owner,
    lifecycle: el.lifecycle,
    label: el.label
  }),
  toElement: config => ({
    schema: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? '',
    label: config.label ?? '',
    metricType: config.metricType
  }),
  defaultConfig: () => ({ metricType: 'entity-count' }),
  isValidConfig: () => true,
  ConfigForm: EntityMetricConfigForm
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
  const metricType = element.metricType;
  const hasValue = !!(schema || owner || lifecycle || label || metricType);

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
          metricType={metricType}
        />
      }
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
          spec={entityMetricMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
