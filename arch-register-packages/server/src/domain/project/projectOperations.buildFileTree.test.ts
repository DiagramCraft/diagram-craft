import { describe, expect, it } from 'vitest';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { buildFileTree } from './contentTreeOperations';

const now = new Date('2025-06-01T12:00:00.000Z');

const makeNode = (
  overrides: Partial<ContentNodeDbResult> & Pick<ContentNodeDbResult, 'id' | 'path' | 'name'>
): ContentNodeDbResult => {
  const { id, path, name, ...rest } = overrides;

  return {
    workspace: 'ws-1',
    project_id: 'project-1',
    entity_id: null,
    parent_id: null,
    role: null,
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null,
    metadata_title: null,
    metadata_description: null,
    metadata_company: null,
    metadata_category: null,
    metadata_keywords: [],
    ...rest,
    id,
    path,
    name
  };
};

describe('buildFileTree', () => {
  it('omits attachment container subtrees from the normal file tree', () => {
    const ordinaryFolder = makeNode({
      id: 'folder-1',
      path: 'docs',
      name: 'docs',
      type: 'folder'
    });
    const markdown = makeNode({
      id: 'page-1',
      parent_id: ordinaryFolder.id,
      path: 'docs/page.md',
      name: 'Page',
      type: 'markdown'
    });
    const attachments = makeNode({
      id: 'attachments-1',
      parent_id: markdown.id,
      path: 'docs/page/__attachments',
      name: '__attachments',
      role: 'attachment-container',
      type: 'folder'
    });
    const diagramAttachment = makeNode({
      id: 'attachment-diagram',
      parent_id: attachments.id,
      path: 'docs/page/__attachments/overview.json',
      name: 'Overview',
      type: 'diagram'
    });
    const tree = buildFileTree([markdown, attachments, diagramAttachment, ordinaryFolder]);

    expect(tree.rootFiles.map(file => file.id)).toEqual([]);
    expect(tree.folders.map(folder => folder.path)).toEqual(['docs']);
    expect(tree.folders[0]?.files.map(file => file.id)).toEqual([markdown.id]);
  });
});
