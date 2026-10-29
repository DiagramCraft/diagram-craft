import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const dateBucketChartWidgetConfigSchema = z.object({
  /** Entity-query DSL text selecting the records to chart. */
  query: withInitial(z.string().trim().min(1), ''),
  /** Date field whose month decides the bucket. */
  dateFieldId: withInitial(z.string().trim().min(1), ''),
  /** Number/currency field summed per bucket; omit to chart record counts. */
  measureFieldId: z.string().optional(),
  /** Number of months shown, starting at the current month. Default 12. */
  bucketCount: z.number().optional(),
  /** Count past-dated records in the current month instead of dropping them. */
  foldOverdue: z.boolean().optional(),
  /** Buckets with a record due within this many days (or overdue) are drawn in the urgent colour. */
  urgentWithinDays: z.number().optional()
});

export type DateBucketChartWidgetConfig = z.infer<typeof dateBucketChartWidgetConfigSchema>;
