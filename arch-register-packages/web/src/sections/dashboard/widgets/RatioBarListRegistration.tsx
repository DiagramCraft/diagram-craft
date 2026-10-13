import { TbChartBar } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { RatioBarListConfigForm } from './RatioBarListConfigForm';
import {
  isRatioBarListConfigComplete,
  RatioBarListWidget,
  type RatioBarListWidgetConfig
} from './RatioBarListWidget';

export const RATIO_BAR_LIST_TYPE = 'RatioBarList' as const;

export const ratioBarListSpec: DashboardWidgetSpec<RatioBarListWidgetConfig> = {
  icon: TbChartBar,
  label: 'Ratio bars',
  description: 'One coverage bar per value of a field, filled by the share matching a field value.',
  defaultW: 6,
  defaultH: 16,
  surfaces: ['workspace'],
  component: RatioBarListWidget,
  isValidConfig: (config): config is RatioBarListWidgetConfig =>
    typeof config.schemaName === 'string' &&
    typeof config.groupByFieldId === 'string' &&
    typeof config.numeratorFieldId === 'string' &&
    typeof config.numeratorValue === 'string' &&
    isRatioBarListConfigComplete(config as RatioBarListWidgetConfig),
  createDefaultConfig: () => ({
    schemaName: '',
    groupByFieldId: '',
    numeratorFieldId: '',
    numeratorValue: ''
  }),
  configForm: RatioBarListConfigForm
};
