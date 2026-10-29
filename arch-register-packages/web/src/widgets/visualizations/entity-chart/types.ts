import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const ENTITY_CHART_GROUP_BY = ['lifecycle', 'owner', 'schema'] as const;
export const ENTITY_CHART_TYPES = ['donut', 'bar'] as const;

export const entityChartWidgetConfigSchema = z
  .object({
    schema: z.string().optional(),
    owner: z.string().optional(),
    lifecycle: z.string().optional(),
    groupBy: withInitial(z.enum(ENTITY_CHART_GROUP_BY), 'lifecycle'),
    chartType: withInitial(z.enum(ENTITY_CHART_TYPES), 'donut')
  })
  .refine(config => !!(config.schema || config.owner || config.lifecycle), {
    message: 'At least one filter is required'
  });

export type EntityChartWidgetConfig = z.infer<typeof entityChartWidgetConfigSchema>;
