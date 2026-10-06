import { TbChartBar } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { CountByFieldConfigForm } from './CountByFieldConfigForm';
import {
  CountByFieldWidget,
  isCountByFieldConfigComplete,
  type CountByFieldWidgetConfig
} from './CountByFieldWidget';

export const COUNT_BY_FIELD_TYPE = 'CountByField' as const;

export const countByFieldSpec: DashboardWidgetSpec<CountByFieldWidgetConfig> = {
  icon: TbChartBar,
  label: 'Count by field',
  description: 'Entity count with a stacked bar per value of a field.',
  defaultW: 6,
  defaultH: 8,
  surfaces: ['workspace'],
  component: CountByFieldWidget,
  isValidConfig: (config): config is CountByFieldWidgetConfig =>
    typeof config.schemaName === 'string' &&
    typeof config.fieldId === 'string' &&
    (config.label === undefined || typeof config.label === 'string') &&
    isCountByFieldConfigComplete(config as CountByFieldWidgetConfig),
  createDefaultConfig: () => ({ schemaName: '', fieldId: '' }),
  getTitle: config => config.label?.trim() || 'Count by field',
  configForm: CountByFieldConfigForm
};
