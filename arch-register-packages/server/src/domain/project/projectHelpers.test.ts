import { describe, expect, it } from 'vitest';
import type { ProjectDbResult, ContentNodeDbResult } from './db/projectDatabase';
import { toApiProject, toApiProjectDetail, toApiProjectFile } from './projectHelpers';
import { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';

const now = new Date('2025-06-01T12:00:00.000Z');
const nowIso = '2025-06-01T12:00:00.000Z';

const baseProject: ProjectDbResult = {
  id: 'p-1',
  workspace: 'ws-1',
  name: 'My Project',
  description: 'desc',
  owner: null,
  status: 'active',
  color: '#ff0000',
  target_date: null,
  pinned: false,
  created_at: now,
  updated_at: now,
  owner_name: null
};

const baseProjectFile: ContentNodeDbResult = {
  id: 'f-1',
  workspace: 'ws-1',
  project_id: 'p-1',
  entity_id: null,
  parent_id: null,
  path: '/diagrams/main.dc',
  name: 'Main',
  type: 'diagram',
  size_bytes: 1024,
  comment_count: 2,
  unresolved_comment_count: 1,
  is_template: false,
  is_workspace_template: false,
  preview_svg: null,
  created_at: now,
  updated_at: now,
  created_by: null,
  updated_by: null
};

// ── toApiProject ──────────────────────────────────────────────

describe('toApiProject', () => {
  it('maps fields and serializes dates', () => {
    const result = toApiProject(baseProject, 7, null);
    expect(result.id).toBe('p-1');
    expect(result.file_count).toBe(7);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });
});

// ── toApiProjectFile ──────────────────────────────────────────

describe('toApiProjectFile', () => {
  it('maps all fields and serializes dates', () => {
    const result = toApiProjectFile(baseProjectFile);
    expect(result.id).toBe('f-1');
    expect(result.project_id).toBe('p-1');
    expect(result.size_bytes).toBe(1024);
    expect(result.comment_count).toBe(2);
    expect(result.unresolved_comment_count).toBe(1);
    expect(result.is_template).toBe(false);
    expect(result.created_at).toBe(nowIso);
  });
});

// ── toApiProjectDetail ────────────────────────────────────────

describe('toApiProjectDetail', () => {
  it('counts root files', () => {
    const files: FileTree = {
      folders: [],
      rootFiles: [
        baseProjectFile as unknown as ProjectFile,
        baseProjectFile as unknown as ProjectFile
      ]
    };
    const result = toApiProjectDetail(baseProject, files, null);
    expect(result.file_count).toBe(2);
  });

  it('counts files in folders', () => {
    const folder = {
      path: '/diagrams',
      name: 'diagrams',
      files: [baseProjectFile as unknown as ProjectFile, baseProjectFile as unknown as ProjectFile]
    };
    const files: FileTree = { folders: [folder], rootFiles: [] };
    const result = toApiProjectDetail(baseProject, files, null);
    expect(result.file_count).toBe(2);
  });

  it('sums files across folders and root', () => {
    const folder = {
      path: '/diagrams',
      name: 'diagrams',
      files: [baseProjectFile as unknown as ProjectFile]
    };
    const files: FileTree = {
      folders: [folder],
      rootFiles: [baseProjectFile as unknown as ProjectFile]
    };
    const result = toApiProjectDetail(baseProject, files, null);
    expect(result.file_count).toBe(2);
  });
});
