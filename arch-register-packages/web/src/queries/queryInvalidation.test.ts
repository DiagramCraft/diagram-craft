import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { documentKeys } from '../hooks/useDocuments';
import { auditKeys } from './audit';
import { dashboardKeys } from './dashboard';
import { definitionImportKeys, invalidateDefinitionImportQueries } from './definitionImports';
import { invalidateDeletedEntity, invalidateEntityQueries } from './entities';
import { jobKeys, invalidateJobQueries } from './jobs';
import { governanceKeys, invalidateGovernanceQueries } from './governance';
import { invalidateNotificationQueries, notificationKeys } from './notifications';
import { invalidateDeletedProject } from './projects';
import { fieldGroupKeys } from './fieldGroups';
import { relationSchemaKeys } from './relationSchemas';
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
    expect(jobKeys.runs('ws-1', { status: 'running' }).slice(0, 3)).toEqual(
      jobKeys.runsWorkspace('ws-1')
    );
    expect(definitionImportKeys.sources('ws-1')).toEqual(['definition-import-sources', 'ws-1']);
  });
});

describe('workspace-scoped invalidation', () => {
  it('invalidates only entity query families belonging to the mutated workspace', async () => {
    const { client, invalidateQueries } = queryClientSpy();

    await invalidateEntityQueries(client, 'ws-1');

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['entities', 'list', 'ws-1'],
      ['entities', 'detail', 'ws-1'],
      ['entities', 'count', 'ws-1'],
      ['entities', 'tree', 'ws-1'],
      ['entities', 'facets', 'ws-1'],
      ['entities', 'timelineMarkers', 'ws-1'],
      ['entities', 'relations', 'ws-1'],
      ['entities', 'typed-relations', 'ws-1'],
      ['entities', 'batch-relations', 'ws-1'],
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

  it('invalidates governance and notification queries only for the mutated workspace', async () => {
    const { client, invalidateQueries } = queryClientSpy();

    await invalidateGovernanceQueries(client, 'ws-1');
    await invalidateNotificationQueries(client, 'ws-1');

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      governanceKeys.tasksWorkspace('ws-1'),
      governanceKeys.count('ws-1'),
      governanceKeys.submissionsWorkspace('ws-1'),
      governanceKeys.eventsWorkspace('ws-1'),
      notificationKeys.watched('ws-1'),
      notificationKeys.pinned('ws-1'),
      notificationKeys.list('ws-1'),
      notificationKeys.count('ws-1')
    ]);
    expect(
      invalidateQueries.mock.calls.every(([options]) => !options.queryKey.includes('ws-2'))
    ).toBe(true);
  });

  it('invalidates all job query families using the workspace run prefix', async () => {
    const { client, invalidateQueries } = queryClientSpy();

    await invalidateJobQueries(client, 'ws-1');

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      jobKeys.servers('ws-1'),
      jobKeys.schedules('ws-1'),
      jobKeys.runsWorkspace('ws-1')
    ]);
  });

  it('invalidates canonical definition-import dependencies only for the importing workspace', async () => {
    const { client, invalidateQueries } = queryClientSpy();

    await invalidateDefinitionImportQueries(client, 'ws-1');

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      schemaKeys.list('ws-1'),
      enumKeys.list('ws-1'),
      documentKeys.typesRoot('ws-1'),
      relationSchemaKeys.list('ws-1'),
      fieldGroupKeys.list('ws-1'),
      dashboardKeys.list('ws-1'),
      auditKeys.workspaceLogs('ws-1')
    ]);
    expect(
      invalidateQueries.mock.calls.every(([options]) => !options.queryKey.includes('ws-2'))
    ).toBe(true);
  });
});
