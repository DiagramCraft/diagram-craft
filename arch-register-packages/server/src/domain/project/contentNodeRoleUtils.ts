import type { ContentNodeDbResult } from './db/projectDatabase';

export const CONTENT_NODE_ROLE_ATTACHMENT_CONTAINER = 'attachment-container' as const;
export const ATTACHMENT_CONTAINER_NAME = '__attachments';

export const isAttachmentContainerNode = (
  node: Pick<ContentNodeDbResult, 'role'>
): node is Pick<ContentNodeDbResult, 'role'> & { role: 'attachment-container' } =>
  node.role === CONTENT_NODE_ROLE_ATTACHMENT_CONTAINER;

export const collectDescendantNodes = (
  nodes: readonly ContentNodeDbResult[],
  rootId: string
): ContentNodeDbResult[] => {
  const byParentId = new Map<string, ContentNodeDbResult[]>();
  for (const node of nodes) {
    if (node.parent_id === null) continue;
    const siblings = byParentId.get(node.parent_id) ?? [];
    siblings.push(node);
    byParentId.set(node.parent_id, siblings);
  }

  const descendants: ContentNodeDbResult[] = [];
  const queue = [...(byParentId.get(rootId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    descendants.push(current);
    queue.push(...(byParentId.get(current.id) ?? []));
  }

  return descendants;
};

export const getAttachmentContainerForMarkdownNode = (
  nodes: readonly ContentNodeDbResult[],
  markdownNodeId: string
) =>
  nodes.find(
    node =>
      node.parent_id === markdownNodeId &&
      node.name === ATTACHMENT_CONTAINER_NAME &&
      isAttachmentContainerNode(node)
  ) ?? null;

export const getMarkdownAttachmentNodes = (
  nodes: readonly ContentNodeDbResult[],
  markdownNodeId: string
) => {
  const container = getAttachmentContainerForMarkdownNode(nodes, markdownNodeId);
  if (!container) return [];
  return collectDescendantNodes(nodes, container.id).filter(node => node.id !== container.id);
};

export const collectHiddenAttachmentNodeIds = (nodes: readonly ContentNodeDbResult[]) => {
  const hidden = new Set<string>();

  for (const node of nodes) {
    if (!isAttachmentContainerNode(node)) continue;
    hidden.add(node.id);
    for (const descendant of collectDescendantNodes(nodes, node.id)) {
      hidden.add(descendant.id);
    }
  }

  return hidden;
};
