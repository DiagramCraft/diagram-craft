import { z } from 'zod';
import { relationPairsSourceShape } from '../../data-views/relation-pairs-coverage/types';

export const relationPairGapsWidgetConfigSchema = z.object(relationPairsSourceShape);

export type RelationPairGapsWidgetConfig = z.infer<typeof relationPairGapsWidgetConfigSchema>;
