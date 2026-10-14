import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  DATE_BUCKET_CHART_TYPE,
  DateBucketChartConfigForm,
  DateBucketChartHeaderActions,
  DateBucketChartWidget,
  DateBucketChartWidgetConfig,
  isDateBucketChartConfigComplete,
  isOptionalNumber
} from './DateBucketChartWidget';

export default defineComponent({
  type: DATE_BUCKET_CHART_TYPE,
  category: 'visualizations',
  name: 'Date bar chart',
  description:
    'Bars per month for a date field - record counts or a summed amount, e.g. renewals, expiries or reviews due.',
  icon: TbChartBar,
  component: DateBucketChartWidget,
  createDefaultProps: () => ({ config: { query: '', dateFieldId: '' } }),
  configForm: DateBucketChartConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 12,
    surfaces: ['workspace'],
    headerActionsComponent: DateBucketChartHeaderActions,
    isValidConfig: (config): config is DateBucketChartWidgetConfig =>
      typeof config.query === 'string' &&
      typeof config.dateFieldId === 'string' &&
      (config.measureFieldId === undefined || typeof config.measureFieldId === 'string') &&
      isOptionalNumber(config.bucketCount) &&
      isOptionalNumber(config.urgentWithinDays) &&
      (config.foldOverdue === undefined || typeof config.foldOverdue === 'boolean') &&
      isDateBucketChartConfigComplete(config as DateBucketChartWidgetConfig)
  }
});
