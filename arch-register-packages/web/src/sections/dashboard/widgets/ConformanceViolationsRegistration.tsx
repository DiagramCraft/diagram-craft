import { TbShieldExclamation } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { ConformanceViolationsConfigForm } from './ConformanceViolationsConfigForm';
import {
  ConformanceViolationsHeaderActions,
  ConformanceViolationsWidget,
  type ConformanceViolationsWidgetConfig
} from './ConformanceViolationsWidget';

export const CONFORMANCE_VIOLATIONS_TYPE = 'ConformanceViolations' as const;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isValidConfig = (
  config: Record<string, unknown>
): config is ConformanceViolationsWidgetConfig =>
  typeof config.schemaName === 'string' &&
  config.schemaName.length > 0 &&
  typeof config.limit === 'number' &&
  config.limit > 0 &&
  (config.checkNames === undefined || isStringArray(config.checkNames)) &&
  (config.label === undefined || typeof config.label === 'string');

export const conformanceViolationsSpec: DashboardWidgetSpec<ConformanceViolationsWidgetConfig> = {
  icon: TbShieldExclamation,
  label: 'Conformance violations',
  description:
    'Entities of a schema with active conformance violations, with the failing checks, worst first.',
  defaultW: 12,
  defaultH: 14,
  surfaces: ['workspace'],
  component: ConformanceViolationsWidget,
  headerActionsComponent: ConformanceViolationsHeaderActions,
  frame: { padded: false, showIcon: false },
  isValidConfig,
  createDefaultConfig: () => ({ schemaName: '', limit: 8 }),
  getTitle: config => config.label?.trim() || 'Conformance violations',
  configForm: ConformanceViolationsConfigForm
};
