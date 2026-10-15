/** Dashboard-only widget; editing is handled by the dashboard config dialog. */
import { TbMarkdown } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  MarkdownDashboardConfigForm,
  MarkdownWidget,
  markdownWidgetConfigSchema
} from './MarkdownWidget';
export default defineWidget({
  type: 'markdown',
  category: 'content-layout',
  name: 'Markdown',
  description: 'Display simple Markdown content on the dashboard.',
  icon: TbMarkdown,
  component: MarkdownWidget,
  configForm: MarkdownDashboardConfigForm,
  configSchema: markdownWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  }
});
