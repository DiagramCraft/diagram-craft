import {
  aggregateStatDisplaySchema,
  aggregateStatSeveritySchema,
  isQueryStatConfig
} from './aggregateStatQuery';
import { z } from 'zod';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';
import { withInitial } from '../../shared/configSchema';

export const aggregateStatWidgetConfigSchema = z
  .object({
    /** Query-mode: entity-query DSL text whose matching-record count is the stat's value. */
    query: withInitial(z.string().optional(), ''),
    /** Query-mode: when set, `percent`/`ofTotal` divide `query`'s count by this query's count. */
    denominatorQuery: z.string().optional(),
    display: withInitial(aggregateStatDisplaySchema.optional(), 'count'),
    /**
     * Query-mode: `count` (default) shows the number of matching records; `sum` shows the total of
     * `sumFieldId` (a number or currency field) across them. Independently, `{subSum}` in
     * `subtextTemplate` is the `sumFieldId` total over `subtextQuery`'s records. `countDistinct`
     * shows how many distinct values `distinctFieldId` takes across the matching records. With
     * `display: 'percent'`, `sum` divides `query`'s sum by `denominatorQuery`'s sum.
     */
    measure: z.enum(['count', 'sum', 'countDistinct']).optional(),
    sumFieldId: z.string().optional(),
    distinctFieldId: z.string().optional(),
    /** Query-mode: optional second count, available as `{sub}` in `subtextTemplate`. */
    subtextQuery: z.string().optional(),
    subtextTemplate: z.string().optional(),
    severity: aggregateStatSeveritySchema.optional(),
    /** Legacy mode: the schema whose entities are counted. */
    schema: z.string().optional(),
    owner: z.string().optional(),
    lifecycle: z.string().optional(),
    /** Legacy mode: the entities matching this condition form the numerator. */
    numeratorCondition: filterConditionSchema.optional(),
    showLink: z.boolean().optional()
  })
  .superRefine((config, ctx) => {
    const require = (condition: boolean, path: string, message: string) => {
      if (!condition) ctx.addIssue({ code: 'custom', path: [path], message });
    };

    if (isQueryStatConfig(config)) {
      require(config.measure !== 'sum' || !!config.sumFieldId, 'sumFieldId', 'A sum needs a field');
      require(config.measure !== 'countDistinct' ||
        !!config.distinctFieldId, 'distinctFieldId', 'A distinct count needs a field');
      const needsDenominator = config.display === 'percent' || config.display === 'ofTotal';
      require(!needsDenominator ||
        !!config.denominatorQuery?.trim(), 'denominatorQuery', 'A percentage needs a denominator query');
    } else {
      require(!!config.schema, 'schema', 'Needs a schema or a query');
      require(!!config.numeratorCondition?.fieldId, 'numeratorCondition', 'Needs a numerator');
    }
  });

export type AggregateStatWidgetConfig = z.infer<typeof aggregateStatWidgetConfigSchema>;
