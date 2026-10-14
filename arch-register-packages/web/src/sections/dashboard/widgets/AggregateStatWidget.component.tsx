/**
 * Dashboard-only widget: a percentage/coverage stat computed as (entities matching a configured
 * condition) / (entities matching the base schema/owner/lifecycle filter), scoped to whatever
 * entity schema the widget is configured against - not tied to any particular schema.
 */
import { TbPercentage } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { isQueryStatConfig } from './aggregateStatQuery';
import type { AggregateStatWidgetConfig } from './AggregateStatWidget';
import {
  AGGREGATE_STAT_TYPE,
  AggregateStatConfigForm,
  AggregateStatWidget,
  isValidLegacyCore,
  isValidQueryStatConfig
} from './AggregateStatWidget';
export default defineComponent({
  type: AGGREGATE_STAT_TYPE,
  category: 'metrics',
  name: 'Aggregate stat',
  description:
    'A count or percentage of records matching a query, e.g. coverage, compliance or items needing attention.',
  component: AggregateStatWidget,
  createDefaultProps: () => ({ config: { query: '', display: 'count' as const } }),
  configForm: AggregateStatConfigForm,
  dashboardWidget: {
    icon: TbPercentage,
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: (config): config is AggregateStatWidgetConfig =>
      (isQueryStatConfig(config) ? isValidQueryStatConfig(config) : isValidLegacyCore(config)) &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.showLink === undefined || typeof config.showLink === 'boolean')
  }
});
