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
