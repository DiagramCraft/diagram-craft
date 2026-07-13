import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateDeletedEntity, invalidateEntityQueries } from './entities';
import { invalidateDeletedProject } from './projects';
import {
  invalidateTemplateStatus,
  projectTemplatesQuery,
  templateKeys,
  workspaceTemplatesQuery
} from './templates';
import { enumKeys, invalidateDeletedEnum } from './enums';
import { invalidateDeletedSchema, schemaKeys } from './schemas';
import { invalidateSavedViewQueries, viewKeys } from './views';

const queryClientSpy = () => {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  const removeQueries = vi.fn();
  return {
    client: { invalidateQueries, removeQueries } as unknown as QueryClient,
    invalidateQueries,
    removeQueries
  };
};

describe('domain query definitions', () => {
  it('uses the same typed template keys in query options and invalidation prefixes', () => {
    expect(projectTemplatesQuery('ws-1', 'project-1').queryKey).toEqual(
      templateKeys.project('ws-1', 'project-1')
    );
    expect(workspaceTemplatesQuery('ws-1').queryKey).toEqual(templateKeys.workspace('ws-1'));
    expect(templateKeys.projectWorkspace('ws-1')).toEqual(['project-templates', 'ws-1']);
  });
});

describe('workspace-scoped invalidation', () => {
  it('invalidates only entity query families belonging to the mutated workspace', async () => {
    const { client, invalidateQueries } = queryClientSpy();

    await invalidateEntityQueries(client, 'ws-1');

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['entities', 'list', 'ws-1'],
      ['entities', 'count', 'ws-1'],
      ['entities', 'tree', 'ws-1'],
      ['entities', 'facets', 'ws-1'],
      ['entities', 'timelineMarkers', 'ws-1'],
      ['audit', 'log', 'ws-1'],
      ['audit', 'stats', 'ws-1'],
      ['workspace-analytics', 'ws-1']
    ]);
  });

  it('evicts only the deleted project and its workspace dependents', async () => {
    const { client, invalidateQueries, removeQueries } = queryClientSpy();

    await invalidateDeletedProject(client, 'ws-1', 'project-1');

    expect(removeQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['projects', 'detail', 'ws-1', 'project-1'],
      ['project-files', 'list', 'ws-1', 'project-1'],
      ['project-entities', 'ws-1', 'project-1']
    ]);
    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['projects', 'list', 'ws-1'],
      ['entity-projects', 'ws-1'],
      ['audit', 'log', 'ws-1'],
      ['audit', 'stats', 'ws-1'],
      ['workspace-analytics', 'ws-1']
    ]);
  });

  it('evicts a deleted entity and refreshes relationship caches in its workspace', async () => {
    const { client, invalidateQueries, removeQueries } = queryClientSpy();

    await invalidateDeletedEntity(client, 'ws-1', 'entity-1');

    expect(removeQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['entities', 'detail', 'ws-1', 'entity-1'],
      ['entities', 'relations', 'ws-1', 'entity-1']
    ]);
    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toContainEqual([
      'entities',
      'batch-relations',
      'ws-1'
    ]);
    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toContainEqual([
      'entities',
      'dependents',
      'ws-1'
    ]);
    expect(
      invalidateQueries.mock.calls.every(([options]) => !options.queryKey.includes('ws-2'))
    ).toBe(true);
  });

  it('refreshes both template families after changing template status', async () => {
    const { client, invalidateQueries } = queryClientSpy();

    await invalidateTemplateStatus(client, 'ws-1', 'project-1');

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['projects', 'list', 'ws-1'],
      ['audit', 'log', 'ws-1'],
      ['audit', 'stats', 'ws-1'],
      ['workspace-analytics', 'ws-1'],
      ['projects', 'detail', 'ws-1', 'project-1'],
      ['project-files', 'list', 'ws-1', 'project-1'],
      ['project-entities', 'ws-1', 'project-1'],
      ['project-templates', 'ws-1'],
      ['workspace-templates', 'ws-1']
    ]);
  });

  it('targets enum, schema, and saved-view mutations to one workspace', async () => {
    const { client, invalidateQueries, removeQueries } = queryClientSpy();

    await invalidateDeletedEnum(client, 'ws-1', 'enum-1');
    await invalidateDeletedSchema(client, 'ws-1', 'schema-1');
    await invalidateSavedViewQueries(client, 'ws-1');

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      enumKeys.list('ws-1'),
      schemaKeys.list('ws-1'),
      viewKeys.workspaceLists('ws-1')
    ]);
    expect(removeQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      enumKeys.detail('ws-1', 'enum-1'),
      schemaKeys.detail('ws-1', 'schema-1')
    ]);
  });
});
