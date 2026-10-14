import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { TABS_TYPE } from './tabsLogic';
import { _tabsSpecData } from './TabsWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _tabsSpecData;
export default defineComponent({
  type: TABS_TYPE,
  category: 'content-layout',
  name: 'Tabs',
  description: 'Groups other widgets into switchable tabs.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
