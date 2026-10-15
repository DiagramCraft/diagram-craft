import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const markdownWidgetConfigSchema = z.object({
  markdown: withInitial(z.string(), '')
});

export type MarkdownWidgetConfig = z.infer<typeof markdownWidgetConfigSchema>;
