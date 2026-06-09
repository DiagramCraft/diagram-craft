import { describe, it, expect } from 'vitest';
import { buildAllTemplatesResponse, buildProjectTemplatesResponse } from './templateHelpers';
import { ProjectFileRow } from '../project/db/projectDatabase';

const now = new Date('2026-06-06T00:00:00.000Z');

const makeFile = (overrides: Partial<ProjectFileRow> & { id: string }): ProjectFileRow => ({
  workspace: 'ws-1',
  project_id: 'proj-1',
  path: 'diagrams/diagram.json',
  name: 'Diagram',
  size_bytes: 100,
  comment_count: 0,
  unresolved_comment_count: 0,
  is_template: false,
  is_workspace_template: false,
  preview_svg: null,
  created_at: now,
  updated_at: now,
  ...overrides
});

const proj1 = { id: 'proj-1' };
const proj2 = { id: 'proj-2' };

// ── buildAllTemplatesResponse ──────────────────────────────────

describe('buildAllTemplatesResponse', () => {
  it('returns empty lists when there are no projects', () => {
    const result = buildAllTemplatesResponse([]);
    expect(result.workspaceTemplates).toHaveLength(0);
    expect(result.projectTemplates).toEqual({});
  });

  it('excludes non-template files', () => {
    const file = makeFile({ id: 'f1', is_template: false });
    const result = buildAllTemplatesResponse([{ project: proj1, files: [file] }]);
    expect(result.workspaceTemplates).toHaveLength(0);
    expect(result.projectTemplates).toEqual({});
  });

  it('places workspace templates in workspaceTemplates', () => {
    const file = makeFile({ id: 'f1', is_template: true, is_workspace_template: true });
    const result = buildAllTemplatesResponse([{ project: proj1, files: [file] }]);
    expect(result.workspaceTemplates).toHaveLength(1);
    expect(result.workspaceTemplates[0]!.id).toBe('f1');
    expect(result.projectTemplates).toEqual({});
  });

  it('places project-level templates under the correct project id', () => {
    const file = makeFile({ id: 'f1', is_template: true, is_workspace_template: false });
    const result = buildAllTemplatesResponse([{ project: proj1, files: [file] }]);
    expect(result.workspaceTemplates).toHaveLength(0);
    expect(result.projectTemplates['proj-1']).toHaveLength(1);
    expect(result.projectTemplates['proj-1']![0]!.id).toBe('f1');
  });

  it('separates templates from multiple projects correctly', () => {
    const wsTemplate = makeFile({
      id: 'ws-t',
      is_template: true,
      is_workspace_template: true,
      project_id: 'proj-1'
    });
    const projTemplate1 = makeFile({
      id: 'p1-t',
      is_template: true,
      is_workspace_template: false,
      project_id: 'proj-1'
    });
    const projTemplate2 = makeFile({
      id: 'p2-t',
      is_template: true,
      is_workspace_template: false,
      project_id: 'proj-2'
    });
    const nonTemplate = makeFile({ id: 'plain', is_template: false, project_id: 'proj-1' });

    const result = buildAllTemplatesResponse([
      { project: proj1, files: [wsTemplate, projTemplate1, nonTemplate] },
      { project: proj2, files: [projTemplate2] }
    ]);

    expect(result.workspaceTemplates).toHaveLength(1);
    expect(result.workspaceTemplates[0]!.id).toBe('ws-t');
    expect(result.projectTemplates['proj-1']).toHaveLength(1);
    expect(result.projectTemplates['proj-1']![0]!.id).toBe('p1-t');
    expect(result.projectTemplates['proj-2']).toHaveLength(1);
    expect(result.projectTemplates['proj-2']![0]!.id).toBe('p2-t');
  });

  it('collects multiple workspace templates from different projects', () => {
    const t1 = makeFile({
      id: 'ws-t1',
      is_template: true,
      is_workspace_template: true,
      project_id: 'proj-1'
    });
    const t2 = makeFile({
      id: 'ws-t2',
      is_template: true,
      is_workspace_template: true,
      project_id: 'proj-2'
    });

    const result = buildAllTemplatesResponse([
      { project: proj1, files: [t1] },
      { project: proj2, files: [t2] }
    ]);

    expect(result.workspaceTemplates).toHaveLength(2);
    expect(result.projectTemplates).toEqual({});
  });

  it('returns empty projectTemplates entry for a project with only workspace templates', () => {
    const wsTemplate = makeFile({ id: 'ws-t', is_template: true, is_workspace_template: true });
    const result = buildAllTemplatesResponse([{ project: proj1, files: [wsTemplate] }]);
    expect(result.projectTemplates['proj-1']).toBeUndefined();
  });
});

// ── buildProjectTemplatesResponse ─────────────────────────────

describe('buildProjectTemplatesResponse', () => {
  it('returns empty lists when there are no projects', () => {
    const result = buildProjectTemplatesResponse([], 'proj-1');
    expect(result.workspaceTemplates).toHaveLength(0);
    expect(result.projectTemplates).toHaveLength(0);
  });

  it('excludes non-template files', () => {
    const file = makeFile({ id: 'f1', is_template: false });
    const result = buildProjectTemplatesResponse([{ project: proj1, files: [file] }], 'proj-1');
    expect(result.workspaceTemplates).toHaveLength(0);
    expect(result.projectTemplates).toHaveLength(0);
  });

  it('workspace templates from any project go into workspaceTemplates', () => {
    const t1 = makeFile({
      id: 'ws-t1',
      is_template: true,
      is_workspace_template: true,
      project_id: 'proj-1'
    });
    const t2 = makeFile({
      id: 'ws-t2',
      is_template: true,
      is_workspace_template: true,
      project_id: 'proj-2'
    });

    const result = buildProjectTemplatesResponse(
      [
        { project: proj1, files: [t1] },
        { project: proj2, files: [t2] }
      ],
      'proj-1'
    );

    expect(result.workspaceTemplates).toHaveLength(2);
    expect(result.projectTemplates).toHaveLength(0);
  });

  it('project-level templates only from the target project go into projectTemplates', () => {
    const ownTemplate = makeFile({
      id: 'own',
      is_template: true,
      is_workspace_template: false,
      project_id: 'proj-1'
    });
    const otherTemplate = makeFile({
      id: 'other',
      is_template: true,
      is_workspace_template: false,
      project_id: 'proj-2'
    });

    const result = buildProjectTemplatesResponse(
      [
        { project: proj1, files: [ownTemplate] },
        { project: proj2, files: [otherTemplate] }
      ],
      'proj-1'
    );

    expect(result.projectTemplates).toHaveLength(1);
    expect(result.projectTemplates[0]!.id).toBe('own');
  });

  it('mixes workspace and project templates correctly', () => {
    const wsTemplate = makeFile({
      id: 'ws-t',
      is_template: true,
      is_workspace_template: true,
      project_id: 'proj-2'
    });
    const projTemplate = makeFile({
      id: 'p-t',
      is_template: true,
      is_workspace_template: false,
      project_id: 'proj-1'
    });

    const result = buildProjectTemplatesResponse(
      [
        { project: proj1, files: [projTemplate] },
        { project: proj2, files: [wsTemplate] }
      ],
      'proj-1'
    );

    expect(result.workspaceTemplates).toHaveLength(1);
    expect(result.workspaceTemplates[0]!.id).toBe('ws-t');
    expect(result.projectTemplates).toHaveLength(1);
    expect(result.projectTemplates[0]!.id).toBe('p-t');
  });
});
