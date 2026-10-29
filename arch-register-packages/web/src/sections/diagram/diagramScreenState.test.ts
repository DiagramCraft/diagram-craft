import { describe, expect, it } from 'vitest';
import {
  deriveDiagramScope,
  diagramRoomName,
  diagramScopeOwnerId,
  injectPublicDiagramProvider
} from './diagramScreenState';

describe('diagram screen state', () => {
  it('derives project, entity, and workspace content scopes', () => {
    expect(deriveDiagramScope({ workspaceSlug: 'w', diagramId: 'd', projectId: 'p' })).toEqual({
      diagramId: 'd',
      scope: { kind: 'project', workspaceId: 'w', projectId: 'p' }
    });
    expect(deriveDiagramScope({ workspaceSlug: 'w', diagramId: 'd', entityId: 'e' })).toEqual({
      diagramId: 'd',
      scope: { kind: 'entity', workspaceId: 'w', entityId: 'e' }
    });
    expect(deriveDiagramScope({ workspaceSlug: 'w', diagramId: 'd' })).toEqual({
      diagramId: 'd',
      scope: { kind: 'workspace', workspaceId: 'w' }
    });
  });

  it('prefers the entity over the project when both ids are present', () => {
    expect(
      deriveDiagramScope({ workspaceSlug: 'w', diagramId: 'd', projectId: 'p', entityId: 'e' })
        .scope.kind
    ).toBe('entity');
  });

  it('resolves the owner id of each scope', () => {
    expect(diagramScopeOwnerId({ kind: 'project', workspaceId: 'w', projectId: 'p' })).toBe('p');
    expect(diagramScopeOwnerId({ kind: 'entity', workspaceId: 'w', entityId: 'e' })).toBe('e');
    expect(diagramScopeOwnerId({ kind: 'workspace', workspaceId: 'w' })).toBe('w');
  });

  it('names the collaboration room per scope', () => {
    expect(diagramRoomName({ kind: 'project', workspaceId: 'w', projectId: 'p' }, 'f')).toBe(
      'w/p/f.json'
    );
    expect(diagramRoomName({ kind: 'entity', workspaceId: 'w', entityId: 'e' }, 'f')).toBe(
      'w/e/f.json'
    );
    expect(diagramRoomName({ kind: 'workspace', workspaceId: 'w' }, 'f')).toBe(
      'w/workspace-content/f.json'
    );
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
