import { describe, expect, it } from 'vitest';
import {
  buildCreateProjectInput,
  buildFileTree,
  buildUpdateProjectInput,
  describeProjectFileRelocation,
  parseProjectStatus,
  resolveProjectOwner
} from './projectRoutes';
import { Project, ProjectFileRow } from '@arch-register/server/domain/project/db/projectDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const baseProject: Project = {
  id: 'project-1',
  workspace: 'default',
  name: 'Project One',
  description: 'Original description',
  owner: 'platform-team',
  status: 'active',
  color: '#123456',
  created_at: now,
  updated_at: now
};

describe('project route helpers', () => {
  it('defaults project status to active', () => {
    expect(parseProjectStatus(undefined)).toBe('active');
    expect(parseProjectStatus('')).toBe('active');
  });

  it('rejects invalid project status values', () => {
    expect(() => parseProjectStatus('draft')).toThrow(
      'status must be one of: pinned, active, archived'
    );
  });

  it('resolves owner only when it matches a known team', () => {
    const teamIds = new Set(['platform-team', 'ux-team']);
    expect(resolveProjectOwner('ux-team', teamIds)).toBe('ux-team');
    expect(resolveProjectOwner('missing-team', teamIds)).toBeNull();
    expect(resolveProjectOwner(null, teamIds)).toBeNull();
  });

  it('builds create project input with normalized optional values', () => {
    const input = buildCreateProjectInput(
      'default',
      {
        name: 'New Project',
        description: 123,
        owner: 'missing-team',
        status: undefined,
        color: 42
      },
      new Set(['platform-team']),
      now
    );

    expect(input).toMatchObject({
      workspace: 'default',
      name: 'New Project',
      description: '',
      owner: null,
      status: 'active',
      color: null,
      created_at: now,
      updated_at: now
    });
    expect(input.id).toBeTypeOf('string');
  });

  it('builds update project input preserving existing fields when omitted', () => {
    const result = buildUpdateProjectInput(
      {
        name: 'Renamed Project'
      },
      baseProject,
      new Set(['platform-team']),
      now
    );

    expect(result.owner).toBe('platform-team');
    expect(result.input).toEqual({
      name: 'Renamed Project',
      description: 'Original description',
      owner: 'platform-team',
      status: 'active',
      color: '#123456',
      updated_at: now
    });
  });

  it('builds update project input with normalized explicit values', () => {
    const result = buildUpdateProjectInput(
      {
        name: 'Renamed Project',
        description: 123,
        owner: 'ux-team',
        status: 'archived',
        color: 99
      },
      baseProject,
      new Set(['platform-team', 'ux-team']),
      now
    );

    expect(result.owner).toBe('ux-team');
    expect(result.input).toEqual({
      name: 'Renamed Project',
      description: '',
      owner: 'ux-team',
      status: 'archived',
      color: null,
      updated_at: now
    });
  });

  it('builds a file tree with sorted folders and root files', () => {
    const files: ProjectFileRow[] = [
      {
        id: 'f-root',
        workspace: 'default',
        project_id: 'project-1',
        path: 'overview.dgc',
        name: 'overview.dgc',
        size_bytes: 10,
        comment_count: 0,
        unresolved_comment_count: 0,
        is_template: false,
        is_workspace_template: false,
        preview_svg: null,
        created_at: now,
        updated_at: now
      },
      {
        id: 'f-b',
        workspace: 'default',
        project_id: 'project-1',
        path: 'b-folder/second.dgc',
        name: 'second.dgc',
        size_bytes: 10,
        comment_count: 0,
        unresolved_comment_count: 0,
        is_template: false,
        is_workspace_template: false,
        preview_svg: null,
        created_at: now,
        updated_at: now
      },
      {
        id: 'f-a',
        workspace: 'default',
        project_id: 'project-1',
        path: 'a-folder/first.dgc',
        name: 'first.dgc',
        size_bytes: 10,
        comment_count: 0,
        unresolved_comment_count: 0,
        is_template: false,
        is_workspace_template: false,
        preview_svg: null,
        created_at: now,
        updated_at: now
      }
    ];

    const tree = buildFileTree(files);

    expect(tree.rootFiles).toHaveLength(1);
    expect(tree.rootFiles[0]!.path).toBe('overview.dgc');
    expect(tree.folders.map(folder => folder.path)).toEqual(['a-folder', 'b-folder']);
  });

  it('describes file relocation for rename and move cases', () => {
    expect(
      describeProjectFileRelocation('flows/login-sequence.dgc', 'flows/auth-sequence.json')
    ).toEqual({
      oldFolder: 'flows',
      newFolder: 'flows',
      displayName: 'auth-sequence',
      operation: 'rename'
    });

    expect(
      describeProjectFileRelocation('flows/login-sequence.dgc', 'archives/auth-sequence.dgc')
    ).toEqual({
      oldFolder: 'flows',
      newFolder: 'archives',
      displayName: 'auth-sequence.dgc',
      operation: 'move_rename'
    });
  });
});
