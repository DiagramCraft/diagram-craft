import type { TElement } from 'platejs';
import { z } from 'zod';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';

export type DocumentBrowserSort = 'title' | 'updated_at' | string;

export const DOCUMENT_BROWSER_BASE_COLUMN_IDS = [
  'document_type',
  'location',
  'updated_at'
] as const;

export type DocumentBrowserBaseColumnId = (typeof DOCUMENT_BROWSER_BASE_COLUMN_IDS)[number];

export const documentBrowserEmbedConfigSchema = z.object({
  q: z.string(),
  documentTypeId: z.string().min(1).optional(),
  conditions: z.array(filterConditionSchema),
  sort: z.string().min(1),
  sortDir: z.enum(['asc', 'desc']),
  visibleBaseColumnIds: z.array(z.enum(DOCUMENT_BROWSER_BASE_COLUMN_IDS)),
  visibleFieldIds: z.array(z.string())
});

export type DocumentBrowserEmbedConfig = z.infer<typeof documentBrowserEmbedConfigSchema>;

export interface DocumentBrowserEmbedSlateElement extends TElement {
  config?: string;
}

export type DocumentBrowserScope = {
  scope: 'workspace' | 'project' | 'entity';
  projectId?: string;
  entityId?: string;
};
