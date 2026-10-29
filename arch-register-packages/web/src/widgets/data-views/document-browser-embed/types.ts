import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';

export type DocumentBrowserSort = 'title' | 'updated_at' | string;

export const DOCUMENT_BROWSER_BASE_COLUMN_IDS = [
  'document_type',
  'location',
  'updated_at'
] as const;

export type DocumentBrowserBaseColumnId = (typeof DOCUMENT_BROWSER_BASE_COLUMN_IDS)[number];

export const documentBrowserEmbedConfigSchema = z.object({
  q: withInitial(z.string(), ''),
  documentTypeId: z.string().min(1).optional(),
  conditions: withInitial(z.array(filterConditionSchema), () => []),
  sort: withInitial(z.string().min(1), 'updated_at'),
  sortDir: withInitial(z.enum(['asc', 'desc']), 'desc'),
  visibleBaseColumnIds: withInitial(z.array(z.enum(DOCUMENT_BROWSER_BASE_COLUMN_IDS)), () => [
    ...DOCUMENT_BROWSER_BASE_COLUMN_IDS
  ]),
  visibleFieldIds: withInitial(z.array(z.string()), () => [])
});

export type DocumentBrowserEmbedConfig = z.infer<typeof documentBrowserEmbedConfigSchema>;

export type DocumentBrowserScope = {
  scope: 'workspace' | 'project' | 'entity';
  projectId?: string;
  entityId?: string;
};
