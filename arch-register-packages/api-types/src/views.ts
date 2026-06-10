import type { z } from 'zod';
import type {
  browserViewSchema,
  createViewBodySchema,
  entityFiltersSchema,
  filterConditionSchema,
  radarViewConfigSchema,
  savedViewSchema,
  timelineViewConfigSchema,
  updateViewBodySchema
} from './viewContract.js';

export type BrowserView = z.infer<typeof browserViewSchema>;

export type FilterCondition = z.infer<typeof filterConditionSchema>;

export type EntityFilters = z.infer<typeof entityFiltersSchema>;

export type RadarViewConfig = z.infer<typeof radarViewConfigSchema>;

export type TimelineViewConfig = z.infer<typeof timelineViewConfigSchema>;

export type SavedView = z.infer<typeof savedViewSchema>;

export type CreateSavedViewRequest = z.infer<typeof createViewBodySchema>;

export type UpdateSavedViewRequest = z.infer<typeof updateViewBodySchema>;
