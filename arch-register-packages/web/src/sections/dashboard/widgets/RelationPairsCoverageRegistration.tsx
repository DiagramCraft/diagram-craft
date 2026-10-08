import { TbArrowsJoin } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { RelationPairsCoverageConfigForm } from './RelationPairsCoverageConfigForm';
import {
  RelationPairsCoverageWidget,
  type RelationPairsCoverageWidgetConfig
} from './RelationPairsCoverageWidget';

export const RELATION_PAIRS_COVERAGE_TYPE = 'RelationPairsCoverage' as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string';

const isValidConfig = (
  config: Record<string, unknown>
): config is RelationPairsCoverageWidgetConfig =>
  isNonEmptyString(config.hubSchemaName) &&
  isNonEmptyString(config.providerFieldName) &&
  isNonEmptyString(config.consumerFieldName) &&
  isNonEmptyString(config.coverageRelationSchemaName) &&
  isOptionalString(config.hubLabel) &&
  isOptionalString(config.providerLabel) &&
  isOptionalString(config.consumerLabel) &&
  isOptionalString(config.coverageLabel) &&
  isOptionalString(config.label);

export const relationPairsCoverageSpec: DashboardWidgetSpec<RelationPairsCoverageWidgetConfig> = {
  icon: TbArrowsJoin,
  label: 'Pair coverage',
  description:
    'Every provider × consumer pair around a shared entity, and whether a chosen relation type connects the two.',
  defaultW: 12,
  defaultH: 24,
  surfaces: ['workspace'],
  component: RelationPairsCoverageWidget,
  frame: { padded: false, showIcon: false },
  isValidConfig,
  createDefaultConfig: () => ({
    hubSchemaName: '',
    providerFieldName: '',
    consumerFieldName: '',
    coverageRelationSchemaName: ''
  }),
  getTitle: config => config.label?.trim() || 'Pair coverage',
  configForm: RelationPairsCoverageConfigForm
};
