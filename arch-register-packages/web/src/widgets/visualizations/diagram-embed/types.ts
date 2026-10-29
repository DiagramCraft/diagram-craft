import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const diagramEmbedWidgetConfigSchema = z.object({
  fileId: withInitial(z.string().min(1), ''),
  caption: z.string().optional()
});

export type DiagramEmbedWidgetConfig = z.infer<typeof diagramEmbedWidgetConfigSchema>;
