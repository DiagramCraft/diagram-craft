import type { TElement } from 'platejs';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

export type DocumentBrowserSort = 'title' | 'updated_at' | string;

export type DocumentBrowserEmbedConfig = {
  q: string;
  documentTypeId?: string;
  conditions: FilterCondition[];
  sort: DocumentBrowserSort;
  sortDir: 'asc' | 'desc';
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
