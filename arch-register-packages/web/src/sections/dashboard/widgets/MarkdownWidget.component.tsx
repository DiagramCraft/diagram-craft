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
  component: MarkdownWidget,
  createDefaultProps: () => ({ config: { markdown: '' } }),
  configForm: MarkdownDashboardConfigForm,
  dashboardWidget: {
    icon: TbMarkdown,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    isValidConfig: (config): config is MarkdownWidgetConfig => typeof config.markdown === 'string'
  }
});
