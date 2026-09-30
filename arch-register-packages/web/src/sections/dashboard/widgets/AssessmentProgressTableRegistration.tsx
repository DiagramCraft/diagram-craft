import { TbChecklist } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { AssessmentSchemaConfigForm } from './AssessmentSchemaConfigForm';
import {
  AssessmentProgressTableWidget,
  type AssessmentProgressTableConfig
} from './AssessmentProgressTableWidget';
import { isAssessmentStatus } from './assessmentSummaryLogic';

export const ASSESSMENT_PROGRESS_TABLE_TYPE = 'AssessmentProgressTable' as const;

/**
 * Dashboard-only table: one row per assessment targeting an entity type, with aggregate progress
 * (in-scope entities with a complete response), due date and derived status.
 */
export const assessmentProgressTableSpec: DashboardWidgetSpec<AssessmentProgressTableConfig> = {
  icon: TbChecklist,
  label: 'Assessment progress',
  description: 'Assessments on an entity type with progress, due date and status.',
  defaultW: 12,
  defaultH: 20,
  surfaces: ['workspace'],
  component: AssessmentProgressTableWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is AssessmentProgressTableConfig =>
    typeof config.schemaName === 'string' &&
    config.schemaName.length > 0 &&
    (config.status === undefined || isAssessmentStatus(config.status)) &&
    (config.label === undefined || typeof config.label === 'string'),
  createDefaultConfig: () => ({ schemaName: '' }),
  getTitle: config => config.label?.trim() || 'Assessments',
  configForm: props => <AssessmentSchemaConfigForm {...props} statusRequired={false} />
};
