import type { TElement } from 'platejs';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

export type DocumentBrowserSort = 'title' | 'updated_at' | string;

export const DOCUMENT_BROWSER_BASE_COLUMN_IDS = [
  'document_type',
  'location',
  'updated_at'
] as const;

export type DocumentBrowserBaseColumnId = (typeof DOCUMENT_BROWSER_BASE_COLUMN_IDS)[number];

export type DocumentBrowserEmbedConfig = {
  q: string;
  documentTypeId?: string;
  conditions: FilterCondition[];
  sort: DocumentBrowserSort;
  sortDir: 'asc' | 'desc';
  visibleBaseColumnIds: DocumentBrowserBaseColumnId[];
  visibleFieldIds: string[];
};

export interface DocumentBrowserEmbedSlateElement extends TElement {
  config?: string;
}

export type DocumentBrowserScope = {
  scope: 'workspace' | 'project' | 'entity';
  projectId?: string;
  entityId?: string;
};
