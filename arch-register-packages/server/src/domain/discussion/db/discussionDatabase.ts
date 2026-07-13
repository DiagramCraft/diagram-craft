export type DiscussionObjectType = 'content_node' | 'assessment' | 'entity';

export type DiscussionPostDbResult = {
  id: string;
  workspace: string;
  object_type: DiscussionObjectType;
  object_id: string;
  parent_post_id: string | null;
  author_id: string | null;
  body: string;
  created_at: Date;
  updated_at: Date;
  edited_at: Date | null;
};

export type DiscussionPostDbCreate = {
  id: string;
  workspace: string;
  object_type: DiscussionObjectType;
  object_id: string;
  parent_post_id: string | null;
  author_id: string | null;
  body: string;
  created_at: Date;
  updated_at: Date;
};

export const discussionMappers = {
  post: (row: DatabaseRow): DiscussionPostDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    object_type: row['object_type'] as DiscussionPostDbResult['object_type'],
    object_id: String(row['object_id']),
    parent_post_id: row['parent_post_id'] == null ? null : String(row['parent_post_id']),
    author_id: row['author_id'] == null ? null : String(row['author_id']),
    body: String(row['body']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    edited_at: row['edited_at'] == null ? null : databaseDate(row['edited_at'])
  })
};

export type DiscussionDatabase = {
  listByObject(
    ws: string,
    objectType: DiscussionObjectType,
    objectId: string
  ): Promise<DiscussionPostDbResult[]>;
  listAll(ws: string): Promise<DiscussionPostDbResult[]>;
  getPost(ws: string, id: string): Promise<DiscussionPostDbResult | null>;
  createPost(input: DiscussionPostDbCreate): Promise<DiscussionPostDbResult>;
  updatePost(
    ws: string,
    id: string,
    body: string,
    updatedAt: Date,
    editedAt: Date
  ): Promise<DiscussionPostDbResult | null>;
  deletePost(ws: string, id: string): Promise<DiscussionPostDbResult | null>;
};
import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';
