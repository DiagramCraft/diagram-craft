import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const savedViewEmbedWidgetConfigSchema = z.object({
  viewId: withInitial(z.string().min(1), '')
});

export type SavedViewEmbedWidgetConfig = z.infer<typeof savedViewEmbedWidgetConfigSchema>;
