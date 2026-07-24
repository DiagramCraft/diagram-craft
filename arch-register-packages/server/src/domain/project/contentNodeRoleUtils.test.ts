import { describe, expect, it } from 'vitest';
import type { ContentNodeDbResult } from './db/projectDatabase';
import {
  ATTACHMENT_CONTAINER_NAME,
  collectHiddenAttachmentNodeIds,
  getAttachmentContainerForMarkdownNode,
  getMarkdownAttachmentNodes
} from './contentNodeRoleUtils';

const now = new Date('2025-06-01T12:00:00.000Z');

const makeNode = (
  overrides: Partial<ContentNodeDbResult> & Pick<ContentNodeDbResult, 'id' | 'path' | 'name'>
): ContentNodeDbResult => {
  const { id, path, name, ...rest } = overrides;

  return {
    workspace: 'ws-1',
    project_id: null,
    entity_id: null,
    parent_id: null,
    role: null,
    type: 'markdown',
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

describe('contentNodeRoleUtils', () => {
  const markdown = makeNode({ id: 'page-1', path: 'page.md', name: 'Page' });
  const attachmentContainer = makeNode({
    id: 'attachments-1',
    parent_id: markdown.id,
    path: `page/${ATTACHMENT_CONTAINER_NAME}`,
    name: ATTACHMENT_CONTAINER_NAME,
    role: 'attachment-container',
    type: 'folder'
  });
  const diagramAttachment = makeNode({
    id: 'diagram-1',
    parent_id: attachmentContainer.id,
    path: `page/${ATTACHMENT_CONTAINER_NAME}/overview.json`,
    name: 'Overview',
    type: 'diagram'
  });
  const fileAttachment = makeNode({
    id: 'file-1',
    parent_id: attachmentContainer.id,
    path: `page/${ATTACHMENT_CONTAINER_NAME}/image.png`,
    name: 'image.png',
    type: 'file'
  });
  const ordinaryChild = makeNode({
    id: 'doc-2',
    parent_id: markdown.id,
    path: 'child.md',
    name: 'Child',
    type: 'markdown'
  });
  const nodes = [markdown, attachmentContainer, diagramAttachment, fileAttachment, ordinaryChild];

  it('finds the markdown attachment container', () => {
    expect(getAttachmentContainerForMarkdownNode(nodes, markdown.id)?.id).toBe(
      attachmentContainer.id
    );
  });

  it('lists only attachment descendants for a markdown node', () => {
    expect(getMarkdownAttachmentNodes(nodes, markdown.id).map(node => node.id)).toEqual([
      diagramAttachment.id,
      fileAttachment.id
    ]);
  });

  it('marks the attachment container subtree as hidden from normal trees', () => {
    expect([...collectHiddenAttachmentNodeIds(nodes)]).toEqual([
      attachmentContainer.id,
      diagramAttachment.id,
      fileAttachment.id
    ]);
  });
});
