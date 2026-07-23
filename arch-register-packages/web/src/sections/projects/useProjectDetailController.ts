import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { useProjectFutureSnapshots } from '../../hooks/useSnapshots';
import {
  useProject,
  useProjectEntities,
  useRemoveProjectEntity,
  useUpdateProject,
  useUpdateProjectEntity
} from '../../hooks/useProjects';
import { useContentScopeOperations, type ContentScope } from '../../hooks/useContentScope';
import { useToggleTemplateStatus } from '../../hooks/useTemplates';
import type { MenuTarget as ProjectMenuTarget } from '../../lib/contentNode';
import type { ProjectSearchParams } from '../../routes/searchParams';

// A "plan change" dialog either creates a new case (optionally seeded with one entity, when
// opened from a single entity row) or edits an existing not-yet-applied case.
export type PlanDialogState = { mode: 'create'; entityId?: string } | { mode: 'edit'; caseId: string };

export const useProjectDetailController = (folder?: string) => {
  const navigate = useNavigate();
  const projectId = useParams({ strict: false }).projectId!;
  const search = useSearch({ strict: false }) as ProjectSearchParams;
  const context = useWorkspaceContext();
  const { workspaceSlug, teams, projectEntityTypes, schemas, lifecycleStates } = context;
  const workspaceId = workspaceSlug;
  const folderFilter = folder ?? null;
  const section =
    search.section === 'entities'
      ? ('entities' as const)
      : search.section === 'assessments'
        ? ('assessments' as const)
        : search.section === 'milestones'
          ? ('milestones' as const)
          : ('home' as const);
  const pendingDialog = search.dialog;
  const contentFolderFilter = section === 'home' ? folderFilter : null;
  const filter = search.contentQuery ?? '';
  const viewMode = search.contentView ?? 'grid';
  const [editing, setEditing] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addFolderParent, setAddFolderParent] = useState<string | null>(null);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addDiagramFolder, setAddDiagramFolder] = useState<string | null>(null);
  const [addMarkdownOpen, setAddMarkdownOpen] = useState(false);
  const [addMarkdownFolder, setAddMarkdownFolder] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [planDialog, setPlanDialog] = useState<PlanDialogState | null>(null);
  const [applyCaseId, setApplyCaseId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; target: ProjectMenuTarget } | null>(
    null
  );
  const [renameTarget, setRenameTarget] = useState<ProjectMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectMenuTarget | null>(null);
  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const updateProject = useUpdateProject(workspaceId);
  const scope: ContentScope = useMemo(
    () => ({ kind: 'project', workspaceId, projectId }),
    [projectId, workspaceId]
  );
  const contentOperations = useContentScopeOperations(scope);
  const toggleTemplateStatusMutation = useToggleTemplateStatus(workspaceId, projectId);
  const mainAreaFileInputRef = useRef<HTMLInputElement>(null);
  const { data: projectEntities = [] } = useProjectEntities(workspaceId, projectId);
  const updateEntityMutation = useUpdateProjectEntity(workspaceId, projectId);
  const removeEntityMutation = useRemoveProjectEntity(workspaceId, projectId);
  const { data: projectSnapshots = [] } = useProjectFutureSnapshots(workspaceId, projectId);
  const futureSnapshots = useMemo(
    () => projectSnapshots.filter(snapshot => snapshot.status === 'future_update'),
    [projectSnapshots]
  );
  const schemaMap = useMemo(
    () =>
      new Map(
        schemas.map((schema, index) => [
          schema.id,
          { color: resolveSchemaColor(schema, index), icon: schema.icon ?? null }
        ])
      ),
    [schemas]
  );
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
    workspaceId,
    teams,
    projectEntityTypes,
    schemas,
    lifecycleStates,
    folderFilter,
    section,
    pendingDialog,
    contentFolderFilter,
    filter,
    viewMode,
    editing,
    setEditing,
    addFolderOpen,
    setAddFolderOpen,
    addFolderParent,
    setAddFolderParent,
    addDiagramOpen,
    setAddDiagramOpen,
    addDiagramFolder,
    setAddDiagramFolder,
    addMarkdownOpen,
    setAddMarkdownOpen,
    addMarkdownFolder,
    setAddMarkdownFolder,
    pinError,
    setPinError,
    addEntityOpen,
    setAddEntityOpen,
    planDialog,
    setPlanDialog,
    applyCaseId,
    setApplyCaseId,
    menu,
    setMenu,
    renameTarget,
    setRenameTarget,
    deleteTarget,
    setDeleteTarget,
    project,
    isLoading,
    updateProject,
    scope,
    contentOperations,
    toggleTemplateStatusMutation,
    mainAreaFileInputRef,
    projectEntities,
    updateEntityMutation,
    removeEntityMutation,
    projectSnapshots,
    futureSnapshots,
    schemaMap,
    entityTypeColorMap,
    activeFolder,
    allFiles,
    visibleFiles
  };
};
