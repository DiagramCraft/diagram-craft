import type { TElement } from 'platejs';
import { z } from 'zod';

export interface EntityActivityTrendChartSlateElement extends TElement {}

export const entityActivityTrendChartPropsSchema = z.object({
  /** Selects the 30-day or 90-day activity window shown by default. */
  lookbackDays: z.number().int().optional()
});

export type EntityActivityTrendChartProps = z.infer<typeof entityActivityTrendChartPropsSchema>;
