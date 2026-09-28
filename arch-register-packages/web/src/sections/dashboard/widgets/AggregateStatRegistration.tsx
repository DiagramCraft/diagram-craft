import type { TElement } from 'platejs';
import { TbPercentage } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { AggregateStatWidget, type AggregateStatWidgetConfig } from './AggregateStatWidget';
import { isQueryStatConfig } from './aggregateStatQuery';
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

const isValidLegacyCore = (config: Record<string, unknown>): boolean =>
  typeof config.schema === 'string' &&
  config.schema.length > 0 &&
  isValidNumeratorCondition(config.numeratorCondition);

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

const isValidQueryStatConfig = (config: Record<string, unknown>): boolean => {
  const display = config.display;
  const severity = config.severity;
  const needsDenominator = display === 'percent' || display === 'ofTotal';
  return (
    (display === undefined || display === 'count' || needsDenominator) &&
    optionalString(config.denominatorQuery) &&
    (!needsDenominator ||
      (typeof config.denominatorQuery === 'string' && config.denominatorQuery.trim() !== '')) &&
    optionalString(config.subtextQuery) &&
    optionalString(config.subtextTemplate) &&
    (severity === undefined ||
      (typeof severity === 'object' &&
        severity !== null &&
        ['warnAt', 'critAt'].every(key => {
          const v = (severity as Record<string, unknown>)[key];
          return v === undefined || typeof v === 'number';
        })))
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
    description:
      'A count or percentage of records matching a query, e.g. coverage, compliance or items needing attention.',
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    component: AggregateStatWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: (config): config is AggregateStatWidgetConfig =>
      (isQueryStatConfig(config) ? isValidQueryStatConfig(config) : isValidLegacyCore(config)) &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.label === undefined || typeof config.label === 'string') &&
      (config.showLink === undefined || typeof config.showLink === 'boolean'),
    createDefaultConfig: () => ({ query: '', display: 'count' as const }),
    getTitle: (config: AggregateStatWidgetConfig) => config.label?.trim() || 'Aggregate stat',
    configForm: AggregateStatConfigForm
  }
});
