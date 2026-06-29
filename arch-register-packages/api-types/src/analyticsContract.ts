import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const lifecycleBucketSchema = z.object({
  lifecycleId: z.string().nullable().describe('Lifecycle state identifier (null for entities without lifecycle)'),
  label: z.string().describe('Lifecycle state label'),
  color: z.string().nullable().describe('Lifecycle state color (hex format)'),
  count: z.number().int().describe('Number of entities in this lifecycle state'),
  percent: z.number().describe('Percentage of total entities in this lifecycle state')
});

const schemaLifecycleBucketSchema = lifecycleBucketSchema.extend({
  schemaId: z.string().describe('Schema identifier')
});

const schemaCountSchema = z.object({
  schemaId: z.string().describe('Schema identifier'),
  schemaName: z.string().describe('Schema name'),
  count: z.number().int().describe('Number of entities using this schema')
});

const schemaOwnershipGapSchema = z.object({
  schemaId: z.string().describe('Schema identifier'),
  schemaName: z.string().describe('Schema name'),
  totalCount: z.number().int().describe('Total number of entities'),
  missingOwnerCount: z.number().int().describe('Number of entities without an owner'),
  missingOwnerPercent: z.number().describe('Percentage of entities without an owner')
});

const schemaCompletenessSchema = z.object({
  schemaId: z.string().describe('Schema identifier'),
  schemaName: z.string().describe('Schema name'),
  totalCount: z.number().int().describe('Total number of entities'),
  below50Count: z.number().int().describe('Number of entities with less than 50% fields filled'),
  between50And79Count: z.number().int().describe('Number of entities with 50-79% fields filled'),
  above80Count: z.number().int().describe('Number of entities with 80% or more fields filled')
});

const schemaCoverageSchema = z.object({
  schemaId: z.string().describe('Schema identifier'),
  schemaName: z.string().describe('Schema name'),
  totalCount: z.number().int().describe('Total number of entities'),
  lifecycleBuckets: z.array(schemaLifecycleBucketSchema).describe('Breakdown by lifecycle state')
});

const analyticsResponseSchema = z.object({
  summary: z.object({
    totalEntities: z.number().int().describe('Total number of entities in the workspace'),
    percentWithOwner: z.number().describe('Percentage of entities with an assigned owner'),
    percentCompleteness80Plus: z.number().describe('Percentage of entities with 80% or more fields filled')
  }).describe('High-level summary statistics'),
  lifecycleBreakdown: z.array(lifecycleBucketSchema).describe('Distribution of entities across lifecycle states'),
  coverage: z.array(schemaCoverageSchema).describe('Schema coverage analysis by lifecycle state'),
  ownershipGaps: z.array(schemaOwnershipGapSchema).describe('Analysis of entities missing owners by schema'),
  completeness: z.array(schemaCompletenessSchema).describe('Analysis of entity field completeness by schema'),
  schemaUtilization: z.array(schemaCountSchema).describe('Number of entities per schema')
});

export const workspaceAnalyticsContract = oc
  .tag('Analytics')
  .router({
    analytics: {
      get: oc
        .route({
          method: 'GET',
          path: '/{workspace}/analytics',
          inputStructure: 'detailed',
          summary: 'Get workspace analytics',
          description: 'Retrieves comprehensive analytics about the workspace, including entity distribution, lifecycle coverage, ownership gaps, and field completeness metrics.',
          tags: ['Analytics']
        })
        .input(z.object({ params: ws }))
        .output(analyticsResponseSchema)
    }
  });

export type LifecycleAnalyticsBucket = z.infer<typeof lifecycleBucketSchema>;
export type SchemaLifecycleAnalyticsBucket = z.infer<typeof schemaLifecycleBucketSchema>;
export type SchemaCountAnalytics = z.infer<typeof schemaCountSchema>;
export type SchemaOwnershipGapAnalytics = z.infer<typeof schemaOwnershipGapSchema>;
export type SchemaCompletenessAnalytics = z.infer<typeof schemaCompletenessSchema>;
export type SchemaCoverageAnalytics = z.infer<typeof schemaCoverageSchema>;
export type WorkspaceAnalytics = z.infer<typeof analyticsResponseSchema>;