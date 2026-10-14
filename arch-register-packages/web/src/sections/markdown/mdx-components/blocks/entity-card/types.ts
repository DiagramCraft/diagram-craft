import type { TElement } from 'platejs';
import { z } from 'zod';

export interface EntityCardSlateElement extends TElement {
  entityId: string;
  fields?: string;
}

export const entityCardWidgetConfigSchema = z.object({
  entityId: z.string().min(1),
  fields: z.string().optional()
});

export type EntityCardWidgetConfig = z.infer<typeof entityCardWidgetConfigSchema>;
