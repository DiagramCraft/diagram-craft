import { oc } from '@orpc/contract';
import { z } from 'zod';
import { currencyCodeSchema, ws } from '@arch-register/api-types/common';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';

// ── Metric source & aggregation ──────────────────────────────────────────────

export const metricTraversalStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('relation').describe('A reference or containment field hop between entities'),
    fieldId: z.string().describe('Reference or containment field identifier'),
    direction: z
      .enum(['forward', 'backward'])
      .describe('Follow the field value forward or find entities pointing backward'),
    ownerSchemaId: z
      .string()
      .optional()
      .describe('Schema owning the field; required for backward hops when ambiguous')
  }),
  z.object({
    kind: z
      .literal('typedRelation')
      .describe('A hop through a typed relation to its other endpoint'),
    fieldId: z.string().describe('Typed-relation field identifier on the current entity schema'),
    relationSchemaId: z.string().describe('Typed relation schema identifier'),
    direction: z
      .enum(['in', 'out'])
      .describe('Direction of the typed-relation field on the current entity schema')
  }),
  z.object({
    kind: z
      .literal('unboundTypedRelation')
      .describe('A hop through a typed relation without a projection field on the current schema'),
    relationSchemaId: z.string().describe('Typed relation schema identifier'),
    direction: z
      .enum(['in', 'out', 'both'])
      .describe('Endpoint occupied by the current entity; both follows both endpoints')
  })
]);

export const metricSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('field').describe('A numeric or currency field on the source schema'),
    fieldId: z.string().describe('Numeric or currency entity field identifier')
  }),
  z.object({
    kind: z
      .literal('assessmentRating')
      .describe('A rating field on the currently joined assessment'),
    fieldId: z.string().describe('Assessment rating field identifier')
  }),
  z.object({
    kind: z.literal('lifecycle').describe('The entity lifecycle state, ranked by its sort order')
  }),
  z.object({
    kind: z.literal('enum').describe('A select field on the source schema'),
    fieldId: z.string().describe('Select field identifier')
  }),
  z.object({
    kind: z.literal('assessmentEnum').describe('An enum field on the currently joined assessment'),
    fieldId: z.string().describe('Assessment enum field identifier')
  })
]);

// Enum-sourced metrics (schema `select` fields and assessment `enum` fields) aggregate to a
// dominant option + full distribution rather than a number, so `sum`/`average`/`minimum`/
// `maximum` aren't meaningful for them. `count` and `worst` are supported: `worst` ranks
// options by their admin-configured top-to-bottom order on the enum (see issue #2168) -
// `worstDirection` selects which end of that list is worse.
export const enumSourceKinds = ['enum', 'assessmentEnum'] as const;

export const metricAggregationSchema = z
  .enum(['count', 'sum', 'average', 'minimum', 'maximum', 'worst', 'percentage'])
  .describe('Aggregation function applied across matching descendant entities');

export const metricConfigSchema = z.object({
  sourceSchemaId: z
    .string()
    .describe('Entity or relation schema identifier for the terminal metric source'),
  sourceContext: z
    .enum(['entity', 'relation'])
    .optional()
    .describe('Whether the terminal metric source is an entity or a typed relation instance'),
  path: z
    .array(metricTraversalStepSchema)
    .max(6)
    .optional()
    .describe('Ordered traversal path from each map box to terminal metric sources'),
  source: metricSourceSchema.describe(
    'Value source for the metric; unused when aggregation is "percentage"'
  ),
  aggregation: metricAggregationSchema,
  numeratorCondition: filterConditionSchema
    .optional()
    .describe(
      'Condition matching the terminal entities counted in the numerator of a "percentage" aggregation; required when aggregation is "percentage"'
    ),
  worstDirection: z
    .enum(['low', 'high'])
    .optional()
    .describe(
      'Direction used for "worst" aggregation. For numeric/lifecycle sources, "low" means lower values are worse and "high" means higher values are worse. For enum sources, "low" means the first option in the enum\'s configured order is worse and "high" means the last option is worse. Required when aggregation is "worst".'
    ),
  targetCurrency: currencyCodeSchema
    .optional()
    .describe('Target currency for currency-field rollups; defaults to the workspace currency')
});

// ── Request / response ───────────────────────────────────────────────────────

export const metricRollupRequestSchema = z.object({
  boxEntityIds: z.array(z.string()).describe('Entity identifiers to compute the metric for'),
  metric: metricConfigSchema.describe('Metric configuration to evaluate'),
  schemaId: z.string().nullable().optional().describe('Filter by schema identifier'),
  owner: z.string().nullable().optional().describe('Filter by owner identifier'),
  lifecycle: z.string().nullable().optional().describe('Filter by lifecycle state'),
  q: z.string().optional().describe('Search query string'),
  conditions: z.array(filterConditionSchema).optional().describe('Additional filter conditions'),
  entityQuery: entityQuerySchema
    .optional()
    .describe(
      'Structured EntityQuery IR; when present, routes filtering through the IR compiler alongside the legacy flat filters above'
    ),
  assessmentId: z
    .string()
    .nullable()
    .optional()
    .describe('Joined assessment identifier — required for assessment-sourced metrics'),
  projectId: z.string().nullable().optional().describe('Filter by project identifier'),
  projectScope: z.enum(['project', 'all']).optional().describe('Project scope filter')
});

export const metricDistributionEntrySchema = z.object({
  value: z.string().describe('Option value'),
  label: z.string().describe('Option display label'),
  count: z.number().int().describe('Number of matching descendants with this option')
});

export const metricResultSchema = z.object({
  boxEntityId: z.string().describe('Entity identifier the result applies to'),
  value: z
    .number()
    .nullable()
    .describe('Aggregated value; null when there is no matching, populated data'),
  lifecycleId: z
    .string()
    .nullable()
    .describe(
      'The descendant lifecycle id that produced the result, for lifecycle-sourced min/max/worst aggregations; null otherwise'
    ),
  dominantValue: z
    .string()
    .nullable()
    .describe(
      'The most common option value among populated descendants, for enum/assessmentEnum sources; ties break toward the option listed first in the enum. Null for non-enum sources or when there is no populated data.'
    ),
  dominantLabel: z.string().nullable().describe('Display label for dominantValue'),
  distribution: z
    .array(metricDistributionEntrySchema)
    .describe(
      'Full option distribution among populated descendants, for enum/assessmentEnum sources; empty for non-enum sources'
    ),
  sourceCount: z
    .number()
    .int()
    .describe('Number of descendants matching the source schema (and current filters)'),
  populatedCount: z
    .number()
    .int()
    .describe('Number of matching descendants that had a non-missing value'),
  duplicateCount: z
    .number()
    .int()
    .describe('Number of additional terminal traversal hits collapsed as duplicates'),
  currencyCode: z
    .string()
    .nullable()
    .optional()
    .describe('Currency code when all populated currency values use the same currency'),
  currencyMixed: z
    .boolean()
    .optional()
    .describe('Whether populated currency values used more than one currency without conversion'),
  currencyRateDate: z
    .string()
    .nullable()
    .optional()
    .describe('Provider rate date used for currency conversion')
});

export const metricLegendSchema = z.object({
  min: z.number().nullable().describe('Lowest aggregated value across all requested boxes'),
  max: z.number().nullable().describe('Highest aggregated value across all requested boxes'),
  currencyCode: z
    .string()
    .nullable()
    .optional()
    .describe('Currency code when all returned currency results use the same currency'),
  currencyMixed: z
    .boolean()
    .optional()
    .describe(
      'Whether returned currency results contain more than one currency without conversion'
    ),
  currencyRateDate: z
    .string()
    .nullable()
    .optional()
    .describe('Provider rate date used for currency conversion'),
  categories: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional()
    .describe(
      'Full option list for the resolved enum, for enum/assessmentEnum sources - including options with zero matches, so the legend can show them as present-but-empty'
    )
});

export const metricRollupResponseSchema = z.object({
  results: z.array(metricResultSchema).describe('Per-box metric results'),
  legend: metricLegendSchema.describe('Legend metadata derived from the returned results')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceMetricContract = oc.tag('Metrics').router({
  metrics: {
    rollup: oc
      .route({
        method: 'POST',
        path: '/{workspace}/metrics/rollup',
        inputStructure: 'detailed',
        summary: 'Compute a metric roll-up over box descendants',
        description:
          'Computes an aggregated metric value for each given box entity, over its containment descendants or configured relation traversal path, permission- and filter-scoped consistently with the entity browser.',
        tags: ['Metrics']
      })
      .input(
        z.object({
          params: ws,
          body: metricRollupRequestSchema
        })
      )
      .output(metricRollupResponseSchema)
  }
});

export type MetricSource = z.infer<typeof metricSourceSchema>;
export type MetricTraversalStep = z.infer<typeof metricTraversalStepSchema>;
export type MetricAggregation = z.infer<typeof metricAggregationSchema>;
export type MetricConfig = z.infer<typeof metricConfigSchema>;
export type MetricRollupRequest = z.infer<typeof metricRollupRequestSchema>;
export type MetricDistributionEntry = z.infer<typeof metricDistributionEntrySchema>;
export type MetricResult = z.infer<typeof metricResultSchema>;
export type MetricLegend = z.infer<typeof metricLegendSchema>;
export type MetricRollupResponse = z.infer<typeof metricRollupResponseSchema>;
