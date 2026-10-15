import { TbBook } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  WikiPageDashboardConfigForm,
  WikiPageWidget,
  WikiPageWidgetTitle,
  wikiPageWidgetConfigSchema
} from './WikiPageWidget';
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
