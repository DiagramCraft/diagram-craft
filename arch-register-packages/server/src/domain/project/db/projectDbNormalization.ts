import type { ContentNodeDbUpsert } from './contentNodeDatabase';
import type { MarkdownRevisionDbCreate } from './markdownRevisionDatabase';
import type { ProjectDbCreate } from './projectCrudDatabase';
import type { ProjectEntityDbCreate } from './projectEntityDatabase';

export const normalizeProjectPublicId = (input: ProjectDbCreate) => ({
  ...input,
  public_id: input.public_id ?? input.id
});

export const getContentNodeOwnership = (input: ContentNodeDbUpsert) => ({
  project_id: input.project_id ?? null,
  entity_id: input.entity_id ?? null,
  parent_id: input.parent_id ?? null
});

export const normalizeContentNodeFields = (input: ContentNodeDbUpsert, id: string) => ({
  id,
  workspace: input.workspace,
  ...getContentNodeOwnership(input),
  path: input.path,
  name: input.name,
  role: input.role ?? null,
  type: input.type ?? 'diagram',
  size_bytes: input.size_bytes,
  comment_count: input.comment_count,
  unresolved_comment_count: input.unresolved_comment_count,
  created_at: input.created_atIfNew,
  updated_at: input.updated_at,
  created_by: input.created_byIfNew ?? null,
  updated_by: input.updated_by ?? null,
  mime_type: input.mime_type ?? null,
  original_filename: input.original_filename ?? null,
  mount_id: input.mount_id ?? null
});

export const normalizeMarkdownRevisionFields = (input: MarkdownRevisionDbCreate) => ({
  ...input,
  restored_from_revision_id: input.restored_from_revision_id ?? null,
  document_type_id: input.document_type_id ?? null,
  metadata: input.metadata ?? {}
});

export const normalizeProjectEntityFields = (input: ProjectEntityDbCreate) => ({
  ...input,
  is_done: input.is_done ?? false
});
