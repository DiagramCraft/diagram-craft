import { TbTable } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { RelationTableConfigForm } from './RelationTableConfigForm';
import { RelationTableWidget, type RelationTableWidgetConfig } from './RelationTableWidget';

export const RELATION_TABLE_TYPE = 'RelationTable' as const;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isValidConfig = (config: Record<string, unknown>): config is RelationTableWidgetConfig =>
  typeof config.relationSchemaName === 'string' &&
  config.relationSchemaName.length > 0 &&
  isStringArray(config.fieldIds) &&
  typeof config.limit === 'number' &&
  config.limit > 0 &&
  (config.filter === undefined || typeof config.filter === 'string') &&
  (config.sort === undefined || typeof config.sort === 'string') &&
  (config.sortDir === undefined || config.sortDir === 'asc' || config.sortDir === 'desc') &&
  (config.label === undefined || typeof config.label === 'string');

export const relationTableSpec: DashboardWidgetSpec<RelationTableWidgetConfig> = {
  icon: TbTable,
  label: 'Relation table',
  description: 'Instances of a relation type, with a chosen set of columns and an optional filter.',
  defaultW: 12,
  defaultH: 24,
  surfaces: ['workspace'],
  component: RelationTableWidget,
  frame: { padded: false, showIcon: false },
  isValidConfig,
  createDefaultConfig: () => ({ relationSchemaName: '', fieldIds: [], limit: 100 }),
  getTitle: config => config.label?.trim() || config.relationSchemaName || 'Relation table',
  configForm: RelationTableConfigForm
};
