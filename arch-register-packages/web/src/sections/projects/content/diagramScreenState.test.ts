import { describe, expect, it } from 'vitest';
import { deriveDiagramScope, injectPublicDiagramProvider } from './diagramScreenState';

describe('diagram screen state', () => {
  it('derives project, entity, and workspace content scopes', () => {
    expect(
      deriveDiagramScope({ workspaceSlug: 'w', diagramId: 'd', projectId: 'p' })
    ).toMatchObject({ projectId: 'p', isEntityDiagram: false, isWorkspaceContent: false });
    expect(deriveDiagramScope({ workspaceSlug: 'w', diagramId: 'd', entityId: 'e' })).toMatchObject(
      { projectId: 'e', isEntityDiagram: true, isWorkspaceContent: false }
    );
    expect(deriveDiagramScope({ workspaceSlug: 'w', diagramId: 'd' })).toMatchObject({
      projectId: 'w',
      isWorkspaceContent: true
    });
  });

  it('injects the public provider while retaining templates and overrides', () => {
    const result = injectPublicDiagramProvider(
      { data: { templates: ['t'], overrides: { a: {} } } } as never,
      [{ id: 's', name: 'Schema', fields: [] }],
      'workspace'
    );
    expect(result.schemas?.[0]?.providerId).toBe('arch-register-public');
    expect(result.data).toMatchObject({ templates: ['t'], overrides: { a: {} } });
  });
});
