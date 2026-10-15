import { TbGitPullRequest } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { ChangeCaseTableConfigForm } from './ChangeCaseTableConfigForm';
import { ChangeCaseTableWidget } from './ChangeCaseTable';
import { changeCaseTableConfigSchema } from './types';

export default defineWidget({
  type: 'ChangeCaseTable',
  category: 'data-views',
  name: 'Change case table',
  description: 'Register of governance cases against entities of a chosen type, in any status.',
  icon: TbGitPullRequest,
  component: ChangeCaseTableWidget,
  configForm: ChangeCaseTableConfigForm,
  configSchema: changeCaseTableConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
