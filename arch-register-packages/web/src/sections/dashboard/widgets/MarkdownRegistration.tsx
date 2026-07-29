import type { TElement } from 'platejs';
import { TbMarkdown } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { MarkdownWidget, type MarkdownWidgetConfig } from './MarkdownWidget';

export const MARKDOWN_WIDGET_TYPE = 'markdown' as const;

interface MarkdownSlateElement extends TElement {}

/** Dashboard-only widget; editing is handled by the dashboard config dialog. */
export const markdownWidgetSpec = defineMdxComponent<
  MarkdownSlateElement,
  { config: MarkdownWidgetConfig },
  'block'
>({
  component: MarkdownWidget,
  mode: 'block',
  allowedProps: [],
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbMarkdown,
    label: 'Markdown',
    description: 'Display simple Markdown content on the dashboard.',
    defaultW: 6,
    defaultH: 4,
    surfaces: ['workspace', 'project'],
    component: MarkdownWidget,
    isValidConfig: (config): config is MarkdownWidgetConfig =>
      typeof config.title === 'string' && typeof config.markdown === 'string',
    createDefaultConfig: () => ({ title: 'Markdown', markdown: '' }),
    getTitle: (config: MarkdownWidgetConfig) => {
      const title = config.title.trim();
      return title.length > 0 ? title : 'Markdown';
    }
  }
});
