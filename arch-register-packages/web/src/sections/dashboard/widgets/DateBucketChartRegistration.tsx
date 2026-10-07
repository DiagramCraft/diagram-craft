import { TbChartBar } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DateBucketChartConfigForm } from './DateBucketChartConfigForm';
import {
  DateBucketChartHeaderActions,
  DateBucketChartWidget,
  isDateBucketChartConfigComplete,
  type DateBucketChartWidgetConfig
} from './DateBucketChartWidget';

export const DATE_BUCKET_CHART_TYPE = 'DateBucketChart' as const;

const optionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));

export const dateBucketChartSpec: DashboardWidgetSpec<DateBucketChartWidgetConfig> = {
  icon: TbChartBar,
  label: 'Date bar chart',
  description:
    'Bars per month for a date field - record counts or a summed amount, e.g. renewals, expiries or reviews due.',
  defaultW: 12,
  defaultH: 12,
  surfaces: ['workspace'],
  component: DateBucketChartWidget,
  headerActionsComponent: DateBucketChartHeaderActions,
  isValidConfig: (config): config is DateBucketChartWidgetConfig =>
    typeof config.query === 'string' &&
    typeof config.dateFieldId === 'string' &&
    (config.measureFieldId === undefined || typeof config.measureFieldId === 'string') &&
    optionalNumber(config.bucketCount) &&
    optionalNumber(config.urgentWithinDays) &&
    (config.foldOverdue === undefined || typeof config.foldOverdue === 'boolean') &&
    (config.label === undefined || typeof config.label === 'string') &&
    isDateBucketChartConfigComplete(config as DateBucketChartWidgetConfig),
  createDefaultConfig: () => ({ query: '', dateFieldId: '' }),
  getTitle: config => config.label?.trim() || 'Date bar chart',
  configForm: DateBucketChartConfigForm
};
