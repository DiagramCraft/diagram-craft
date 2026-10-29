import { TbBook } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { WikiPageDashboardConfigForm } from './WikiPageConfigForm';
import { WikiPageWidget, WikiPageWidgetTitle } from './WikiPage';
import { wikiPageWidgetConfigSchema } from './types';
export default defineWidget({
  type: 'wiki-page',
  category: 'content-layout',
  name: 'Wiki page',
  description: 'Display a selected wiki page on the dashboard.',
  icon: TbBook,
  component: WikiPageWidget,
  configForm: WikiPageDashboardConfigForm,
  configSchema: wikiPageWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    titleComponent: WikiPageWidgetTitle
  },
  configDialog: { width: 520 }
});
