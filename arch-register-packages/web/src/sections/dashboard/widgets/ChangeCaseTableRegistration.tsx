import { TbGitPullRequest } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { ChangeCaseTableConfigForm } from './ChangeCaseTableConfigForm';
import { ChangeCaseTableWidget, type ChangeCaseTableConfig } from './ChangeCaseTableWidget';

export const CHANGE_CASE_TABLE_TYPE = 'ChangeCaseTable' as const;

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';

/**
 * Dashboard-only table of governance cases (every status) against entities of a chosen
 * schema, restricted to a chosen set of case kinds — not tied to any particular app. Generalized
 * from Data Stewardship's former Change cases screen (#3504).
 */
export const changeCaseTableSpec: DashboardWidgetSpec<ChangeCaseTableConfig> = {
  icon: TbGitPullRequest,
  label: 'Change case table',
  description:
    'Register of governance cases against entities of a chosen type, in any status.',
  defaultW: 12,
  defaultH: 20,
  surfaces: ['workspace'],
  component: ChangeCaseTableWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is ChangeCaseTableConfig =>
    typeof config.schemaName === 'string' &&
    Array.isArray(config.caseKinds) &&
    config.caseKinds.every(kind => typeof kind === 'string') &&
    (config.severity === 'none' || config.severity === 'due-date') &&
    isOptionalString(config.status) &&
    isOptionalString(config.label),
  createDefaultConfig: () => ({
    schemaName: '',
    caseKinds: ['entity.change-case'],
    severity: 'due-date'
  }),
  getTitle: config => config.label?.trim() || 'Change cases',
  configForm: ChangeCaseTableConfigForm
};
