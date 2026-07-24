import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';

export type WikiCommentDbResult = {
  id: string;
  workspace: string;
  node_id: string;
  parent_post_id: string | null;
  author_id: string | null;
  body: string;
  quote: string;
  prefix: string;
  suffix: string;
  anchor_start: number;
  anchor_end: number;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
  updated_at: Date;
  edited_at: Date | null;
};

export type WikiCommentDbCreate = {
  id: string;
  workspace: string;
  node_id: string;
  parent_post_id: string | null;
  author_id: string | null;
  body: string;
  quote: string;
  prefix: string;
  suffix: string;
  anchor_start: number;
  anchor_end: number;
  created_at: Date;
  updated_at: Date;
};

export const wikiCommentMappers = {
  post: (row: DatabaseRow): WikiCommentDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    node_id: String(row['node_id']),
    parent_post_id: row['parent_post_id'] == null ? null : String(row['parent_post_id']),
    author_id: row['author_id'] == null ? null : String(row['author_id']),
    body: String(row['body']),
    quote: String(row['quote']),
    prefix: String(row['prefix']),
    suffix: String(row['suffix']),
    anchor_start: Number(row['anchor_start']),
    anchor_end: Number(row['anchor_end']),
    resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at']),
    resolved_by: row['resolved_by'] == null ? null : String(row['resolved_by']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    edited_at: row['edited_at'] == null ? null : databaseDate(row['edited_at'])
  })
};

export type WikiCommentDatabase = {
  listByNode(ws: string, nodeId: string): Promise<WikiCommentDbResult[]>;
  getPost(ws: string, id: string): Promise<WikiCommentDbResult | null>;
  createPost(input: WikiCommentDbCreate): Promise<WikiCommentDbResult>;
  updatePost(
    ws: string,
    id: string,
    body: string,
    updatedAt: Date,
    editedAt: Date
  ): Promise<WikiCommentDbResult | null>;
  setResolved(
    ws: string,
    id: string,
    resolvedAt: Date | null,
    resolvedBy: string | null,
    updatedAt: Date
  ): Promise<WikiCommentDbResult | null>;
  deletePost(ws: string, id: string): Promise<WikiCommentDbResult | null>;
};
