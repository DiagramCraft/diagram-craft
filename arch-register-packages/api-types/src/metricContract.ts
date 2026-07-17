import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';

// ── Metric source & aggregation ──────────────────────────────────────────────

export const metricSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('field').describe('A numeric field on the source schema'),
    fieldId: z.string().describe('Numeric entity field identifier')
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
// dominant option + full distribution rather than a number, so only `count` - which doesn't
// depend on the value's type - is meaningful for them. `worst` additionally has no defined
// ranking for enum options in v1 (see issue #2168) regardless of source kind.
export const enumSourceKinds = ['enum', 'assessmentEnum'] as const;

export const metricAggregationSchema = z
  .enum(['count', 'sum', 'average', 'minimum', 'maximum', 'worst'])
  .describe('Aggregation function applied across matching descendant entities');

export const metricConfigSchema = z.object({
  sourceSchemaId: z
    .string()
    .describe('Schema identifier that descendant source entities must match'),
  source: metricSourceSchema.describe('Value source for the metric'),
  aggregation: metricAggregationSchema,
  worstDirection: z
    .enum(['low', 'high'])
    .optional()
    .describe(
      'Direction used for "worst" aggregation - "low" means lower values are worse, "high" means higher values are worse. Required when aggregation is "worst".'
    )
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
    .describe('Number of matching descendants that had a non-missing value')
});

export const metricLegendSchema = z.object({
  min: z.number().nullable().describe('Lowest aggregated value across all requested boxes'),
  max: z.number().nullable().describe('Highest aggregated value across all requested boxes'),
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
          'Computes an aggregated metric value for each given box entity, over its containment descendants, permission- and filter-scoped consistently with the entity browser.',
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
export type MetricAggregation = z.infer<typeof metricAggregationSchema>;
export type MetricConfig = z.infer<typeof metricConfigSchema>;
export type MetricRollupRequest = z.infer<typeof metricRollupRequestSchema>;
export type MetricDistributionEntry = z.infer<typeof metricDistributionEntrySchema>;
export type MetricResult = z.infer<typeof metricResultSchema>;
export type MetricLegend = z.infer<typeof metricLegendSchema>;
export type MetricRollupResponse = z.infer<typeof metricRollupResponseSchema>;
