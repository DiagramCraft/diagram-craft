import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type {
  ProjectFileSearchResult,
  RelationSearchResult
} from '@arch-register/api-types/searchContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityContentFolderRoute,
  entityDetailRoute,
  projectContentFolderRoute,
  projectDetailRoute,
  workspaceContentFolderRoute
} from '../../routes/publicObjectRoutes';
import { useEntityDrawer } from '../entities/entityDrawer/useEntityDrawer';
import type { SearchRow } from './searchScreenHelpers';

/** Returns a handler that opens a search result: entities in the drawer, everything else by route */
export const useOpenSearchRow = () => {
  const routerNavigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const { workspaceSlug } = useWorkspaceContext();

  const navigateToEntity = useCallback(
    (entityId: string) => {
      openEntityDrawer(entityId);
    },
    [openEntityDrawer]
  );

  const navigateToProject = useCallback(
    (projectId: string) => {
      routerNavigate(
        projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
          tab: 'projects' as const,
          section: 'home' as const
        })
      );
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToProjectFolder = useCallback(
    (projectId: string, folder: string | null) => {
      if (folder) {
        routerNavigate(
          projectContentFolderRoute(workspaceSlug, asProjectPublicId(projectId), folder)
        );
      } else {
        routerNavigate(
          projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
            tab: 'projects' as const,
            section: 'home' as const
          })
        );
      }
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToSchema = useCallback(
    (schemaId: string) => {
      routerNavigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { schema: schemaId }
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToEntityFolder = useCallback(
    (entityId: string, folder: string | null) => {
      if (folder) {
        routerNavigate(entityContentFolderRoute(workspaceSlug, asEntityPublicId(entityId), folder));
      } else {
        routerNavigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
      }
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToWorkspaceFolder = useCallback(
    (folder: string | null) => {
      if (folder) {
        routerNavigate(workspaceContentFolderRoute(workspaceSlug, folder));
      } else {
        routerNavigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } });
      }
    },
    [routerNavigate, workspaceSlug]
  );

  const openRow = useCallback(
    (row: SearchRow) => {
      if (row.kind === 'entity') {
        navigateToEntity(row.id);
      } else if (row.kind === 'project') {
        navigateToProject(row.id);
      } else if (row.kind === 'file') {
        const f = row.data as ProjectFileSearchResult;
        const folder = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : null;
        if (f.scope === 'project' && f.projectId) {
          navigateToProjectFolder(f.projectId, folder);
        } else if (f.scope === 'entity' && f.entityPublicId) {
          navigateToEntityFolder(f.entityPublicId, folder);
        } else if (f.scope === 'workspace') {
          navigateToWorkspaceFolder(folder);
        }
      } else if (row.kind === 'schema') {
        navigateToSchema(row.id);
      } else if (row.kind === 'relation') {
        const r = row.data as RelationSearchResult;
        navigateToEntity(r.inEntityPublicId);
      }
    },
    [
      navigateToEntity,
      navigateToProject,
      navigateToProjectFolder,
      navigateToSchema,
      navigateToEntityFolder,
      navigateToWorkspaceFolder
    ]
  );

  return openRow;
};
