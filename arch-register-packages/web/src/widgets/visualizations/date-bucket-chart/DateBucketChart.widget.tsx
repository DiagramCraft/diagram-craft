import { TbChartBar } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { DateBucketChartConfigForm } from './DateBucketChartConfigForm';
import { DateBucketChartHeaderActions, DateBucketChartWidget } from './DateBucketChart';
import { dateBucketChartWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'DateBucketChart',
  category: 'visualizations',
  name: 'Date bar chart',
  description:
    'Bars per month for a date field - record counts or a summed amount, e.g. renewals, expiries or reviews due.',
  icon: TbChartBar,
  component: DateBucketChartWidget,
  configForm: DateBucketChartConfigForm,
  configSchema: dateBucketChartWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 12,
    surfaces: ['workspace'],
    headerActionsComponent: DateBucketChartHeaderActions
  }
});
