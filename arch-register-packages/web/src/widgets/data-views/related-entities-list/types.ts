import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const relatedEntitiesListWidgetConfigSchema = z
  .object({
    /** Public id of the entity the list is scoped to; usually a sidebar variable reference. */
    entityId: z.string().optional(),
    /** Entity type listed. */
    schemaName: withInitial(z.string().min(1), ''),
    /** Reference field on `schemaName` pointing at the scoping entity (or at the `via` entities). */
    referenceField: withInitial(z.string().min(1), ''),
    /** Optional intermediate hop: entities of this type reference the scoping entity through
     *  `viaReferenceField`, and the listed entities reference those. */
    viaSchemaName: z.string().optional(),
    viaReferenceField: z.string().optional(),
    descriptionField: z.string().optional(),
    statusField: z.string().optional(),
    /** When all three are set, each row shows a baseline → current → target progress bar. */
    progressBaselineField: z.string().optional(),
    progressCurrentField: z.string().optional(),
    progressTargetField: z.string().optional(),
    progressUnitField: z.string().optional(),
    emptyMessage: z.string().optional()
  })
  .refine(config => !config.viaSchemaName === !config.viaReferenceField, {
    message: 'A via schema and its reference field must be set together'
  });

export type RelatedEntitiesListWidgetConfig = z.infer<typeof relatedEntitiesListWidgetConfigSchema>;
