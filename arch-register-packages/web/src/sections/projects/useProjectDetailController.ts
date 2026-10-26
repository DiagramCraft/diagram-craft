import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useChangeCasesByProject } from '../../hooks/useChangeCases';
import {
  useProject,
  useProjectEntities,
  useRemoveProjectEntity,
  useUpdateProjectEntity
} from '../../hooks/useProjects';
import type { ProjectSearchParams } from '../../routes/searchParams';

// A "plan change" dialog either creates a new case (optionally seeded with one entity, when
// opened from a single entity row) or edits an existing not-yet-applied case.
export type PlanDialogState =
  | { mode: 'create'; entityId?: string }
  | { mode: 'edit'; caseId: string };

// Data and route state for the project detail screen. State that belongs to a single section
// (content dialogs, settings form, ...) lives in that section's component.
export const useProjectDetailController = (folder?: string) => {
  const navigate = useNavigate();
  const projectId = useParams({ strict: false }).projectId!;
  const search = useSearch({ strict: false }) as ProjectSearchParams;
  const { workspaceSlug, teams, projectEntityTypes, schemas, lifecycleStates } =
    useWorkspaceContext();
  const section = search.section ?? 'home';
  const pendingDialog = search.dialog;
  const contentFolderFilter = section === 'home' ? (folder ?? null) : null;

  // Dialogs shared by more than one section
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [planDialog, setPlanDialog] = useState<PlanDialogState | null>(null);
  const [applyCaseId, setApplyCaseId] = useState<string | null>(null);

  const { data: project, isLoading } = useProject(workspaceSlug, projectId);
  const { data: projectEntities = [] } = useProjectEntities(workspaceSlug, projectId);
  const updateEntityMutation = useUpdateProjectEntity(workspaceSlug, projectId);
  const removeEntityMutation = useRemoveProjectEntity(workspaceSlug, projectId);
  const { data: changeCases = [] } = useChangeCasesByProject(workspaceSlug, projectId);
  const entityTypeColorMap = useMemo(
    () =>
      new Map(
        projectEntityTypes.map((type, index) => [
          type.id,
          SCHEMA_COLORS[index % SCHEMA_COLORS.length]!
        ])
      ),
    [projectEntityTypes]
  );
  const allFiles = useMemo(
    () =>
      project
        ? [
            ...project.files.rootFiles,
            ...project.files.folders.flatMap(folderItem => folderItem.files)
          ]
        : [],
    [project]
  );
  const activeFolder =
    contentFolderFilter && project
      ? (project.files.folders.find(folderItem => folderItem.path === contentFolderFilter) ?? null)
      : null;
  const visibleFiles = activeFolder ? activeFolder.files : allFiles;

  useEffect(() => {
    if (pendingDialog === 'add-entity') setAddEntityOpen(true);
  }, [pendingDialog]);

  return {
    navigate,
    projectId,
    search,
    workspaceSlug,
    teams,
    projectEntityTypes,
    schemas,
    lifecycleStates,
    section,
    pendingDialog,
    contentFolderFilter,
    addEntityOpen,
    setAddEntityOpen,
    planDialog,
    setPlanDialog,
    applyCaseId,
    setApplyCaseId,
    project,
    isLoading,
    projectEntities,
    updateEntityMutation,
    removeEntityMutation,
    changeCases,
    entityTypeColorMap,
    allFiles,
    visibleFiles
  };
};
