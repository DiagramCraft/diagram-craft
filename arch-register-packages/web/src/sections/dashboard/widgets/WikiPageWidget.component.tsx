import { TbBook } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  WikiPageDashboardConfigForm,
  WikiPageWidget,
  WikiPageWidgetTitle,
  isWikiPageWidgetConfig
} from './WikiPageWidget';
export default defineComponent({
  type: 'wiki-page',
  category: 'content-layout',
  name: 'Wiki page',
  description: 'Display a selected wiki page on the dashboard.',
  icon: TbBook,
  component: WikiPageWidget,
  createDefaultProps: () => ({ config: { nodeId: '' } }),
  configForm: WikiPageDashboardConfigForm,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    titleComponent: WikiPageWidgetTitle,
    isValidConfig: isWikiPageWidgetConfig,
    dialogWidth: 520
  }
});
