import { z } from 'zod';

// `entityId` is the entity's public id, as chosen in the EntityPicker.
export const blastRadiusWidgetConfigSchema = z.object({
  /** Public id of the entity to start from; usually a sidebar variable reference. */
  entityId: z.string().optional(),
  /**
   * When set, the radius is limited to these typed-relation fields of the entity's schema and shown
   * as one column per field plus a "second order" column; otherwise every relation is walked.
   */
  groups: z
    .array(
      z.object({
        fieldName: z.string().min(1),
        label: z.string().min(1),
        emptyText: z.string().optional()
      })
    )
    .optional(),
  maxDepth: z.number().int().min(1).max(3).optional()
});

export type BlastRadiusWidgetConfig = z.infer<typeof blastRadiusWidgetConfigSchema>;
