import { TbLayoutList } from 'react-icons/tb';
import {
  getWidgetDefinition,
  isValidComponentConfig
} from '../../markdown/mdx-components/widgetRegistry';
import { createTabsConfigSchema, TABS_TYPE } from './tabsLogic';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import { TabsConfigForm, TabsWidget } from './TabsWidget';

export default defineWidget({
  type: TABS_TYPE,
  category: 'content-layout',
  name: 'Tabs',
  description: 'Groups other widgets into switchable tabs.',
  icon: TbLayoutList,
  component: TabsWidget,
  configSchema: createTabsConfigSchema(child => {
    const definition = getWidgetDefinition(child.type, 'dashboard');
    return !!definition && isValidComponentConfig(definition, child.config);
  }),
  configForm: TabsConfigForm,
  dashboard: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  },
  configDialog: { size: 'large' }
});
