import type { TElement } from 'platejs';
import { z } from 'zod';
import { withInitial } from '../../configSchema';

export interface DiagramEmbedSlateElement extends TElement {
  fileId: string;
  caption?: string;
}

export const diagramEmbedWidgetConfigSchema = z.object({
  fileId: withInitial(z.string().min(1), ''),
  caption: z.string().optional()
});

export type DiagramEmbedWidgetConfig = z.infer<typeof diagramEmbedWidgetConfigSchema>;
