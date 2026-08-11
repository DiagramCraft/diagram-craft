import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import {
  assessmentResponseKeys,
  restoreAssessmentResponseCache,
  updateAssessmentResponseCache
} from './assessments';
import { contentScopeKey, contentScopeQuery, invalidateContentScope } from './content';
import { auditKeys } from './audit';
import { dashboardKeys } from './dashboard';
import { definitionImportKeys, invalidateDefinitionImportQueries } from './definitionImports';
import {
  entityKeys,
  hydratedEntitiesBySchemaQuery,
  invalidateDeletedEntity,
  invalidateEntityQueries
} from './entities';
import { jobKeys, invalidateJobQueries } from './jobs';
import { governanceKeys, invalidateGovernanceQueries } from './governance';
import {
  addPinnedEntityToCache,
  invalidateNotificationQueries,
  notificationKeys,
  removePinnedEntityFromCache,
  restorePinnedEntitiesCache
} from './notifications';
import { documentKeys, documentTypesQuery } from './documents';
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
import { invalidateDeletedSchema } from './schemas';
import { schemaKeys } from './schemaKeys';
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

  it('keeps query options and cache keys owned by their feature modules', () => {
    const entityScope = { kind: 'entity' as const, workspaceId: 'ws-1', entityId: 'entity-1' };

    expect(documentTypesQuery('ws-1').queryKey).toEqual(documentKeys.types('ws-1'));
    expect(contentScopeQuery(entityScope).queryKey).toEqual(contentScopeKey(entityScope));
    expect(hydratedEntitiesBySchemaQuery('ws-1', 'schema-1').queryKey).toEqual(
      entityKeys.list('ws-1', { schemaId: 'schema-1', view: 'full' })
    );
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

  it('keeps project content invalidation scoped to the project workspace', async () => {
    const { client, invalidateQueries } = queryClientSpy();

    await invalidateContentScope(client, {
      kind: 'project',
      workspaceId: 'ws-1',
      projectId: 'project-1'
    });

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toContainEqual([
      'project-files',
      'list',
      'ws-1',
      'project-1'
    ]);
    expect(
      invalidateQueries.mock.calls.every(([options]) => !options.queryKey.includes('ws-2'))
    ).toBe(true);
  });
});

describe('optimistic cache helpers', () => {
  it('updates and restores pinned-entity cache through the notification query module', async () => {
    const queryClient = new QueryClient();
    const first = {
      entity_id: 'entity-1',
      entity_public_id: 'ENT-1',
      entity_name: 'First entity',
      entity_slug: 'first-entity',
      schema_id: 'schema-1',
      created_at: '2026-08-11T00:00:00.000Z'
    };
    const second = { ...first, entity_id: 'entity-2', entity_public_id: 'ENT-2' };
    queryClient.setQueryData(notificationKeys.pinned('ws-1'), [first]);

    const addContext = await addPinnedEntityToCache(queryClient, 'ws-1', second);
    expect(queryClient.getQueryData(notificationKeys.pinned('ws-1'))).toEqual([second, first]);
    restorePinnedEntitiesCache(queryClient, 'ws-1', addContext);
    expect(queryClient.getQueryData(notificationKeys.pinned('ws-1'))).toEqual([first]);

    const removeContext = await removePinnedEntityFromCache(queryClient, 'ws-1', 'entity-1');
    expect(queryClient.getQueryData(notificationKeys.pinned('ws-1'))).toEqual([]);
    restorePinnedEntitiesCache(queryClient, 'ws-1', removeContext);
    expect(queryClient.getQueryData(notificationKeys.pinned('ws-1'))).toEqual([first]);
  });

  it('merges assessment response values and restores the previous response cache', async () => {
    const queryClient = new QueryClient();
    const fields = [
      {
        id: 'rating',
        label: 'Rating',
        type: 'rating',
        requirementLevel: 'required'
      }
    ] as AssessmentField[];
    const key = assessmentResponseKeys.list('ws-1', 'assessment-1');
    const previous = [
      {
        id: 'response-1',
        entity_id: 'entity-1',
        values: {},
        status: 'not_started' as const,
        updated_at: '2026-08-11T00:00:00.000Z',
        updated_by: null,
        updated_by_name: null
      }
    ];
    queryClient.setQueryData(key, previous);

    const context = await updateAssessmentResponseCache(
      queryClient,
      'ws-1',
      'assessment-1',
      fields,
      'fields',
      { id: 'user-1', display_name: 'User One' },
      'entity-1',
      { rating: 5 }
    );
    expect(queryClient.getQueryData(key)).toMatchObject([
      {
        entity_id: 'entity-1',
        values: { rating: 5 },
        status: 'complete',
        updated_by: 'user-1'
      }
    ]);

    restoreAssessmentResponseCache(queryClient, 'ws-1', 'assessment-1', context);
    expect(queryClient.getQueryData(key)).toEqual(previous);
  });
});
