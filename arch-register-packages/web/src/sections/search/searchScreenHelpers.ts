import { TbCode, TbDatabase, TbFolder, TbFolders } from 'react-icons/tb';
import type {
  EntitySearchResult,
  ProjectFileSearchResult,
  ProjectSearchResult,
  SchemaSearchResult,
  SearchResponse
} from '@arch-register/api-types/searchContract';

export type SearchFilter = 'all' | 'entities' | 'projects' | 'files' | 'schemas';

export type SearchPreview =
  | { type: 'project'; data: ProjectSearchResult }
  | { type: 'file'; data: ProjectFileSearchResult }
  | { type: 'entity'; data: EntitySearchResult }
  | { type: 'schema'; data: SchemaSearchResult };

export type RowId = { kind: string; id: string };

export const CATEGORY_DEFS: Array<{ value: SearchFilter; label: string; icon: typeof TbFolders }> = [
  { value: 'all', label: 'All', icon: TbFolders },
  { value: 'entities', label: 'Entities', icon: TbDatabase },
  { value: 'projects', label: 'Projects', icon: TbFolders },
  { value: 'files', label: 'Diagrams', icon: TbFolder },
  { value: 'schemas', label: 'Schemas', icon: TbCode }
];

export const EMPTY_RESULTS: SearchResponse = {
  query: '',
  projects: [],
  files: [],
  entities: [],
  schemas: []
};

export const snippetAround = (text: string | null | undefined, q: string, max = 140) => {
  if (!text) return '';
  const t = String(text);
  if (!q) return t.length > max ? `${t.slice(0, max)}…` : t;
  const k = t.toLowerCase().indexOf(q.toLowerCase());
  if (k < 0) return t.length > max ? `${t.slice(0, max)}…` : t;
  const start = Math.max(0, k - 40);
  const end = Math.min(t.length, k + q.length + 80);
  return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '');
};

export const getFileMetadataSummary = (file: ProjectFileSearchResult, q: string) => {
  const parts: string[] = [];
  const description = snippetAround(file.content_metadata?.description, q, 110);
  if (description) parts.push(description);
  if (file.content_metadata?.category) parts.push(`Category: ${file.content_metadata.category}`);
  return parts.join(' · ');
};

export const getFileFolder = (path: string) =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : 'Root';

export const getFileContextLabel = (file: ProjectFileSearchResult) => {
  if (file.scope === 'project') return file.projectName ?? 'Project';
  if (file.scope === 'entity') return file.entityName ?? 'Entity';
  return 'Workspace';
};
