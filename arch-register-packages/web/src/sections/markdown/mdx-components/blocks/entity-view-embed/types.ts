import { z } from 'zod';
import type { TElement } from 'platejs';

export interface EntityViewEmbedSlateElement extends TElement {
  viewId?: string;
}

export const savedViewEmbedWidgetConfigSchema = z.object({ viewId: z.string().min(1) });

export type SavedViewEmbedWidgetConfig = z.infer<typeof savedViewEmbedWidgetConfigSchema>;
