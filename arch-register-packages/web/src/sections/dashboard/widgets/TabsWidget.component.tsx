import { TbLayoutList } from 'react-icons/tb';
import {
  getComponentDefinition,
  isValidComponentConfig
} from '../../markdown/mdx-components/componentRegistry';
import { createTabsConfigSchema, TABS_TYPE } from './tabsLogic';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { TabsConfigForm, TabsWidget } from './TabsWidget';

export default defineComponent({
  type: TABS_TYPE,
  category: 'content-layout',
  name: 'Tabs',
  description: 'Groups other widgets into switchable tabs.',
  icon: TbLayoutList,
  component: TabsWidget,
  configSchema: createTabsConfigSchema(child => {
    const definition = getComponentDefinition(child.type, 'dashboardWidget');
    return !!definition && isValidComponentConfig(definition, child.config);
  }),
  configForm: TabsConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    dialogSize: 'large'
  }
});
