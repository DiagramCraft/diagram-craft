/** Dashboard-only widget; editing is handled by the dashboard config dialog. */
import { TbMarkdown } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import type { MarkdownWidgetConfig } from './MarkdownWidget';
import {
  MARKDOWN_WIDGET_TYPE,
  MarkdownDashboardConfigForm,
  MarkdownWidget
} from './MarkdownWidget';
export default defineComponent({
  type: MARKDOWN_WIDGET_TYPE,
  category: 'content-layout',
  name: 'Markdown',
  description: 'Display simple Markdown content on the dashboard.',
  dashboardWidget: {
    icon: TbMarkdown,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: MarkdownWidget,
    isValidConfig: (config): config is MarkdownWidgetConfig => typeof config.markdown === 'string',
    createDefaultConfig: () => ({ markdown: '' }),
    configForm: MarkdownDashboardConfigForm
  }
});
