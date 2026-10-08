import { TbListDetails } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { SpecItemsTableConfigForm } from './SpecItemsTableConfigForm';
import { SpecItemsTableWidget, type SpecItemsTableWidgetConfig } from './SpecItemsTableWidget';

export const SPEC_ITEMS_TABLE_TYPE = 'SpecItemsTable' as const;

const isValidConfig = (config: Record<string, unknown>): config is SpecItemsTableWidgetConfig =>
  typeof config.schemaName === 'string' &&
  config.schemaName.length > 0 &&
  (config.entityQuery === undefined || typeof config.entityQuery === 'object') &&
  (config.deprecated === undefined || typeof config.deprecated === 'boolean') &&
  (config.entityLimit === undefined || typeof config.entityLimit === 'number') &&
  (config.label === undefined || typeof config.label === 'string');

export const specItemsTableSpec: DashboardWidgetSpec<SpecItemsTableWidgetConfig> = {
  icon: TbListDetails,
  label: 'Specification operations',
  description:
    'Operations and messages across the API specifications of every entity of a type, optionally only deprecated ones.',
  defaultW: 12,
  defaultH: 24,
  surfaces: ['workspace'],
  component: SpecItemsTableWidget,
  frame: { padded: false, showIcon: false },
  isValidConfig,
  createDefaultConfig: () => ({ schemaName: '' }),
  getTitle: config => config.label?.trim() || 'Operations',
  configForm: SpecItemsTableConfigForm
};
