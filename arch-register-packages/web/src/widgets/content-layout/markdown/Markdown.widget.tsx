/** Dashboard-only widget; editing is handled by the dashboard config dialog. */
import { TbMarkdown } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { MarkdownDashboardConfigForm } from './MarkdownConfigForm';
import { MarkdownWidget } from './Markdown';
import { markdownWidgetConfigSchema } from './types';
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
