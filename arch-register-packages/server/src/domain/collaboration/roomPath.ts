export type ParsedRoomPath = {
  workspaceSlug: string;
  projectId: string;
  fileId: string;
};

/**
 * Parses the room format used by the Diagram Craft client:
 * workspace/project-or-scope/file-id.json.
 *
 * The project segment is retained for compatibility with existing callers,
 * but callers must resolve authorization and storage from the content node.
 */
export const parseRoomPath = (roomName: string): ParsedRoomPath | null => {
  const parts = roomName.split('/');
  if (parts.length < 3) return null;

  const workspaceSlug = parts[0];
  const projectId = parts[1];
  let fileId = parts.slice(2).join('/');

  if (!workspaceSlug || !projectId || !fileId) return null;
  if (fileId.endsWith('.json')) fileId = fileId.slice(0, -'.json'.length);
  if (!fileId) return null;

  return { workspaceSlug, projectId, fileId };
};
