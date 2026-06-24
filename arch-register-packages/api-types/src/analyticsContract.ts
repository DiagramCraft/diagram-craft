import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const lifecycleBucketSchema = z.object({
  lifecycleId: z.string().nullable(),
  label: z.string(),
  color: z.string().nullable(),
  count: z.number().int(),
  percent: z.number()
});

const schemaLifecycleBucketSchema = lifecycleBucketSchema.extend({
  schemaId: z.string()
});

const schemaCountSchema = z.object({
  schemaId: z.string(),
  schemaName: z.string(),
  count: z.number().int()
});

const schemaOwnershipGapSchema = z.object({
  schemaId: z.string(),
  schemaName: z.string(),
  totalCount: z.number().int(),
  missingOwnerCount: z.number().int(),
  missingOwnerPercent: z.number()
});

const schemaCompletenessSchema = z.object({
  schemaId: z.string(),
  schemaName: z.string(),
  totalCount: z.number().int(),
  below50Count: z.number().int(),
  between50And79Count: z.number().int(),
  above80Count: z.number().int()
});

const schemaCoverageSchema = z.object({
  schemaId: z.string(),
  schemaName: z.string(),
  totalCount: z.number().int(),
  lifecycleBuckets: z.array(schemaLifecycleBucketSchema)
});

const analyticsResponseSchema = z.object({
  summary: z.object({
    totalEntities: z.number().int(),
    percentWithOwner: z.number(),
    percentCompleteness80Plus: z.number()
  }),
  lifecycleBreakdown: z.array(lifecycleBucketSchema),
  coverage: z.array(schemaCoverageSchema),
  ownershipGaps: z.array(schemaOwnershipGapSchema),
  completeness: z.array(schemaCompletenessSchema),
  schemaUtilization: z.array(schemaCountSchema)
});

export const workspaceAnalyticsContract = {
  analytics: {
    get: oc
      .route({ method: 'GET', path: '/{workspace}/analytics', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(analyticsResponseSchema)
  }
};

export type LifecycleAnalyticsBucket = z.infer<typeof lifecycleBucketSchema>;
export type SchemaLifecycleAnalyticsBucket = z.infer<typeof schemaLifecycleBucketSchema>;
export type SchemaCountAnalytics = z.infer<typeof schemaCountSchema>;
export type SchemaOwnershipGapAnalytics = z.infer<typeof schemaOwnershipGapSchema>;
export type SchemaCompletenessAnalytics = z.infer<typeof schemaCompletenessSchema>;
export type SchemaCoverageAnalytics = z.infer<typeof schemaCoverageSchema>;
export type WorkspaceAnalytics = z.infer<typeof analyticsResponseSchema>;
