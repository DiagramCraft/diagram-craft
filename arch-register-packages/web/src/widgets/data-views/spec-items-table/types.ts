import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../shared/configSchema';

export const specItemsTableWidgetConfigSchema = z.object({
  /** Display name of the entity schema whose specification artifacts are listed. */
  schemaName: withInitial(z.string().min(1), ''),
  /** Optional structured filter on those entities (field NAMEs are resolved at render time); may
   *  reference sidebar `$variables` — an empty multi-select means no constraint. */
  entityQuery: entityQuerySchema.optional(),
  /** Only list deprecated items. */
  deprecated: z.boolean().optional(),
  /** Maximum number of entities whose specifications are read. Default 200. */
  entityLimit: z.number().optional()
});

export type SpecItemsTableWidgetConfig = z.infer<typeof specItemsTableWidgetConfigSchema>;
