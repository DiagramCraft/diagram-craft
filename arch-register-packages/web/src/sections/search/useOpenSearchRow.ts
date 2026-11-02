import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type {
  ProjectFileSearchResult,
  RelationSearchResult
} from '@arch-register/api-types/searchContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../entities/entityDrawer/useEntityDrawer';
import type { SearchRow } from './searchScreenHelpers';

/** Returns a handler that opens a search result: entities, projects, diagrams and wiki pages in drawers, everything else by route */
export const useOpenSearchRow = () => {
  const routerNavigate = useNavigate();
  const { openEntityDrawer, openProjectDrawer, openContentDrawer } = useEntityDrawer();
  const { workspaceSlug } = useWorkspaceContext();

  const navigateToEntity = useCallback(
    (entityId: string) => {
      openEntityDrawer(entityId);
    },
    [openEntityDrawer]
  );

  const navigateToProject = useCallback(
    (projectId: string) => {
      openProjectDrawer(projectId);
    },
    [openProjectDrawer]
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

  const openRow = useCallback(
    (row: SearchRow) => {
      if (row.kind === 'entity') {
        navigateToEntity(row.id);
      } else if (row.kind === 'project') {
        navigateToProject(row.id);
      } else if (row.kind === 'file' || row.kind === 'wiki') {
        openContentDrawer(row.data as ProjectFileSearchResult);
      } else if (row.kind === 'schema') {
        navigateToSchema(row.id);
      } else if (row.kind === 'relation') {
        const r = row.data as RelationSearchResult;
        navigateToEntity(r.inEntityPublicId);
      }
    },
    [navigateToEntity, navigateToProject, navigateToSchema, openContentDrawer]
  );

  return openRow;
};
