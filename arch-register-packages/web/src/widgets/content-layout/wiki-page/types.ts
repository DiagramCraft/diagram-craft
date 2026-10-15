import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const wikiPageWidgetConfigSchema = z.object({
  nodeId: withInitial(z.string().min(1), '')
});

export type WikiPageWidgetConfig = z.infer<typeof wikiPageWidgetConfigSchema>;
