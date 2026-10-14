/** Dashboard-only widget; editing is handled by the dashboard config dialog. */
import { TbMarkdown } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  MARKDOWN_WIDGET_TYPE,
  MarkdownDashboardConfigForm,
  MarkdownWidget,
  markdownWidgetConfigSchema
} from './MarkdownWidget';
export default defineComponent({
  type: MARKDOWN_WIDGET_TYPE,
  category: 'content-layout',
  name: 'Markdown',
  description: 'Display simple Markdown content on the dashboard.',
  icon: TbMarkdown,
  component: MarkdownWidget,
  configForm: MarkdownDashboardConfigForm,
  configSchema: markdownWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  }
});
