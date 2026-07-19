import { describe, expect, it } from 'vitest';
import { parseRoomPath } from './roomPath';

describe('parseRoomPath', () => {
  it('parses project rooms and removes the json suffix', () => {
    expect(parseRoomPath('workspace-1/project-1/file-1.json')).toEqual({
      workspaceSlug: 'workspace-1',
      projectId: 'project-1',
      fileId: 'file-1'
    });
  });

  it('retains nested file segments for compatibility', () => {
    expect(parseRoomPath('workspace-1/workspace-content/folder/file-1.json'))?.toEqual({
      workspaceSlug: 'workspace-1',
      projectId: 'workspace-content',
      fileId: 'folder/file-1'
    });
  });

  it.each([
    '',
    'workspace-1',
    'workspace-1/project-1',
    '/workspace-1/project-1/file-1.json'
  ])('rejects malformed room path %j', room => {
    expect(parseRoomPath(room)).toBeNull();
  });
});
