import { TbGitPullRequest } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  ChangeCaseTableConfigForm,
  ChangeCaseTableWidget,
  changeCaseTableConfigSchema
} from './ChangeCaseTableWidget';

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
