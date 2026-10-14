import type { TElement } from 'platejs';
import { z } from 'zod';

export interface EntityTableSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
}

export const entityTableWidgetConfigSchema = z.object({
  schema: z.string().optional(),
  owner: z.string().optional(),
  lifecycle: z.string().optional(),
  limit: z.number().int().optional()
});

export type EntityTableWidgetConfig = z.infer<typeof entityTableWidgetConfigSchema>;
