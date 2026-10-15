import { z } from 'zod';

export const activityFeedWidgetConfigSchema = z.object({ limit: z.number().int().optional() });

export type ActivityFeedWidgetConfig = z.infer<typeof activityFeedWidgetConfigSchema>;
