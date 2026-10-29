import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const IMAGE_ALIGNMENTS = ['left', 'center', 'right'] as const;

export const imageEmbedWidgetConfigSchema = z.object({
  fileId: withInitial(z.string().min(1), ''),
  alt: z.string().optional(),
  size: withInitial(z.string(), '100'),
  align: withInitial(z.enum(IMAGE_ALIGNMENTS), 'center')
});

export type ImageEmbedWidgetConfig = z.infer<typeof imageEmbedWidgetConfigSchema>;
