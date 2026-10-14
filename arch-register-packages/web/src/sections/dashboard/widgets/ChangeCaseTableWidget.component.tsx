import { TbGitPullRequest } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ChangeCaseTableConfigForm,
  ChangeCaseTableWidget,
  changeCaseTableConfigSchema
} from './ChangeCaseTableWidget';

export default defineComponent({
  type: 'ChangeCaseTable',
  category: 'data-views',
  name: 'Change case table',
  description: 'Register of governance cases against entities of a chosen type, in any status.',
  icon: TbGitPullRequest,
  component: ChangeCaseTableWidget,
  configForm: ChangeCaseTableConfigForm,
  configSchema: changeCaseTableConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
