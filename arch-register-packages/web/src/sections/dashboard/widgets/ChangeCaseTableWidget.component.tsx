import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { CHANGE_CASE_TABLE_TYPE, _changeCaseTableSpecData } from './ChangeCaseTableWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _changeCaseTableSpecData;
export default defineComponent({
  type: CHANGE_CASE_TABLE_TYPE,
  category: 'data-views',
  name: 'Change case table',
  description: 'Register of governance cases against entities of a chosen type, in any status.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
