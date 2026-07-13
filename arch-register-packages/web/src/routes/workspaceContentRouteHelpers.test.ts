import { describe, expect, it } from 'vitest';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityContentFolderRoute,
  projectContentFolderRoute,
  workspaceContentFolderRoute
} from './publicObjectRoutes';

describe('workspaceContentFolderRoute', () => {
  it('builds a folder route with its search state', () => {
    expect(workspaceContentFolderRoute('default', 'wiki', {
      contentQuery: 'api',
      contentView: 'list'
    })).toEqual({
      to: '/$workspaceSlug/content/folders/$',
      params: { workspaceSlug: 'default', _splat: 'wiki' },
      search: { contentQuery: 'api', contentView: 'list' }
    });
  });

  it('preserves nested folder paths', () => {
    expect(workspaceContentFolderRoute('default', 'docs/guides')).toEqual({
      to: '/$workspaceSlug/content/folders/$',
      params: { workspaceSlug: 'default', _splat: 'docs/guides' }
    });
  });
});

describe('projectContentFolderRoute', () => {
  it('builds a project folder route with nested paths and search state', () => {
    expect(projectContentFolderRoute(
      'default',
      asProjectPublicId('DW-2'),
      'docs/guides',
      { contentQuery: 'migration', contentView: 'list' }
    )).toEqual({
      to: '/$workspaceSlug/projects/$projectId/folders/$',
      params: { workspaceSlug: 'default', projectId: 'DW-2', _splat: 'docs/guides' },
      search: { contentQuery: 'migration', contentView: 'list' }
    });
  });
});

describe('entityContentFolderRoute', () => {
  it('builds an entity folder route with nested paths and search state', () => {
    expect(entityContentFolderRoute(
      'default',
      asEntityPublicId('API-2'),
      'security/guides',
      { contentQuery: 'threat', contentView: 'list' }
    )).toEqual({
      to: '/$workspaceSlug/entities/$entityId/folders/$',
      params: { workspaceSlug: 'default', entityId: 'API-2', _splat: 'security/guides' },
      search: { contentQuery: 'threat', contentView: 'list' }
    });
  });
});
