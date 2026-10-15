import { z } from 'zod';

// `entityId` is the entity's public id, as chosen in the EntityPicker.
export const blastRadiusWidgetConfigSchema = z.object({
  /** Public id of the entity to start from; usually a sidebar variable reference. */
  entityId: z.string().optional()
});

export type BlastRadiusWidgetConfig = z.infer<typeof blastRadiusWidgetConfigSchema>;
