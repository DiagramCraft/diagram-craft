import type { TElement } from 'platejs';
import { TbPercentage } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { AggregateStatWidget, type AggregateStatWidgetConfig } from './AggregateStatWidget';
import { AggregateStatConfigForm } from './AggregateStatConfigForm';

export const AGGREGATE_STAT_TYPE = 'AggregateStat' as const;

const FILTER_OPS = [
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'ends_with',
  'empty',
  'not_empty',
  'before',
  'after',
  'on',
  'gt',
  'lt',
  'gte',
  'lte'
];

const isValidNumeratorCondition = (value: unknown): boolean => {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.fieldId === 'string' &&
    candidate.fieldId.length > 0 &&
    typeof candidate.op === 'string' &&
    FILTER_OPS.includes(candidate.op)
  );
};

interface AggregateStatSlateElement extends TElement {}

/**
 * Dashboard-only widget: a percentage/coverage stat computed as (entities matching a configured
 * condition) / (entities matching the base schema/owner/lifecycle filter), scoped to whatever
 * entity schema the widget is configured against - not tied to any particular schema.
 */
export const aggregateStatSpec = defineMdxComponent<
  AggregateStatSlateElement,
  { config: AggregateStatWidgetConfig },
  'block'
>({
  component: AggregateStatWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbPercentage,
    label: 'Aggregate stat',
    description: 'A percentage of entities matching a condition, e.g. coverage or compliance.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['workspace', 'project'],
    component: AggregateStatWidget,
    isValidConfig: (config): config is AggregateStatWidgetConfig =>
      typeof config.schema === 'string' &&
      config.schema.length > 0 &&
      isValidNumeratorCondition(config.numeratorCondition) &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.label === undefined || typeof config.label === 'string') &&
      (config.showLink === undefined || typeof config.showLink === 'boolean'),
    createDefaultConfig: () => ({ schema: '' }),
    getTitle: (config: AggregateStatWidgetConfig) => config.label?.trim() || 'Aggregate stat',
    configForm: AggregateStatConfigForm
  }
});
