import { TbGitPullRequest } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  CHANGE_CASE_TABLE_TYPE,
  ChangeCaseTableConfig,
  ChangeCaseTableConfigForm,
  ChangeCaseTableWidget,
  isOptionalString
} from './ChangeCaseTableWidget';

export default defineComponent({
  type: CHANGE_CASE_TABLE_TYPE,
  category: 'data-views',
  name: 'Change case table',
  description: 'Register of governance cases against entities of a chosen type, in any status.',
  icon: TbGitPullRequest,
  component: ChangeCaseTableWidget,
  createDefaultProps: () => ({
    config: {
      schemaName: '',
      caseKinds: ['entity.change-case'],
      severity: 'due-date'
    }
  }),
  configForm: ChangeCaseTableConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: (config): config is ChangeCaseTableConfig =>
      typeof config.schemaName === 'string' &&
      Array.isArray(config.caseKinds) &&
      config.caseKinds.every(kind => typeof kind === 'string') &&
      (config.severity === 'none' || config.severity === 'due-date') &&
      isOptionalString(config.status)
  }
});
