import type { EntitySearchResult } from './entities.js';
import type { ProjectSearchResult, ProjectFileSearchResult } from './projects.js';
import type { SchemaSearchResult } from './schemas.js';

// ── Search Response ───────────────────────────────────────────

export type SearchResponse = {
  query: string;
  projects: ProjectSearchResult[];
  files: ProjectFileSearchResult[];
  entities: EntitySearchResult[];
  schemas: SchemaSearchResult[];
};
