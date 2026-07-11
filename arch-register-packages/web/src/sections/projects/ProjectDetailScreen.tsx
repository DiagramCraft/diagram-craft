import { useState, useRef, useEffect, useMemo } from 'react';
import { useProjectFutureSnapshots } from '../../hooks/useSnapshots';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import styles from './ProjectDetailScreen.module.css';
import { AddFolderDialog } from './AddFolderDialog';
import { AddDiagramDialog } from './AddDiagramDialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbPlus, TbFileText, TbFolder, TbFolderOpen, TbTrash, TbCopy, TbStar, TbPencil, TbDownload } from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { getRouteApi } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { ApiError } from '../../lib/http';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import {
  useProject,
  useUpdateProject,
  useProjectEntities,
  useAddProjectEntity,
  useUpdateProjectEntity,
  useRemoveProjectEntity
} from '../../hooks/useProjects';
import {
  useDeleteProjectFile,
  useDeleteProjectFolder,
  useRenameProjectFolder,
  useCloneProjectFile,
  useRenameProjectFile,
  useRenameProjectBinaryFile,
  useMoveProjectFile,
  useToggleTemplateStatus,
  useCreateProjectMarkdown,
  useUploadProjectFile
} from '../../hooks/useProjectFiles';
import {
  asProjectPublicId,
  projectDetailRoute,
  projectDiagramRoute,
  projectMarkdownRoute
} from '../../routes/publicObjectRoutes';
import { ProjectContent } from './ProjectContent';
import { ProjectDetails } from './ProjectDetails';
import { ProjectEntities } from './ProjectEntities';
import { ProjectAssessments } from './ProjectAssessments';
import { AssessmentDetailsScreen } from './AssessmentDetailsScreen';
import {
  deleteConfirmLabel,
  deleteMessage,
  deleteTitle,
  entityTypeLabel,
  type MenuTarget as ProjectMenuTarget
} from '../../lib/contentNode';
import { RenameDialog } from '../../components/RenameDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { ApplySnapshotDialog } from './components/ApplySnapshotDialog';
import { AddEntityToProjectDialog } from './components/AddEntityToProjectDialog';
import { ProjectSettingsForm } from './components/ProjectSettingsForm';
import { PlanFutureChangeDialog } from './components/PlanFutureChangeDialog';
import { buildFolderTree, type FolderTreeNode } from '../../lib/folderTree';

type ProjectSection = 'home' | 'entities' | 'assessments';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

export const ProjectDetailScreen = () => {
  const navigate = routeApi.useNavigate();
  const { projectId } = routeApi.useParams();
  const search = routeApi.useSearch();
  const { workspaceSlug, teams, projectEntityTypes, schemas, lifecycleStates } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const folderFilter = search.folder ?? null;
  const section: ProjectSection =
    search.section === 'entities' ? 'entities' : search.section === 'assessments' ? 'assessments' : 'home';
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

  // Plan future change state
  const [planEntityId, setPlanEntityId] = useState<string | null>(null);

  // Apply snapshot state
  const [applySnapshot, setApplySnapshot] = useState<EntitySnapshot | null>(null);

  // Context menu state
  const [menu, setMenu] = useState<{ x: number; y: number; target: ProjectMenuTarget } | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectMenuTarget | null>(null);

  // Query hooks
  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const updateProject = useUpdateProject(workspaceId);

  // File mutation hooks
  const deleteFileMutation = useDeleteProjectFile(workspaceId, projectId);
  const deleteFolderMutation = useDeleteProjectFolder(workspaceId, projectId);
  const renameFolderMutation = useRenameProjectFolder(workspaceId, projectId);
  const cloneFileMutation = useCloneProjectFile(workspaceId, projectId);
  const renameFileMutation = useRenameProjectFile(workspaceId, projectId);
  const renameBinaryFileMutation = useRenameProjectBinaryFile(workspaceId, projectId);
  const moveFileMutation = useMoveProjectFile(workspaceId, projectId);
  const toggleTemplateStatusMutation = useToggleTemplateStatus(workspaceId, projectId);
  const createMarkdownMutation = useCreateProjectMarkdown(workspaceId, projectId);
  const uploadFileMutation = useUploadProjectFile(workspaceId, projectId);
  const mainAreaFileInputRef = useRef<HTMLInputElement>(null);

  // Entity hooks
  const { data: projectEntities = [] } = useProjectEntities(workspaceId, projectId);
  const addEntityMutation = useAddProjectEntity(workspaceId, projectId);
  const updateEntityMutation = useUpdateProjectEntity(workspaceId, projectId);
  const removeEntityMutation = useRemoveProjectEntity(workspaceId, projectId);
  const { data: projectSnapshots = [] } = useProjectFutureSnapshots(workspaceId, projectId);
  const futureSnapshots = useMemo(
    () => projectSnapshots.filter(snapshot => snapshot.status === 'future_update'),
    [projectSnapshots]
  );

  const schemaMap = useMemo(() => {
    const m = new Map<string, { color: string; icon: string | null }>();
    schemas.forEach((s, i) =>
      m.set(s.id, { color: resolveSchemaColor(s, i), icon: s.icon ?? null })
    );
    return m;
  }, [schemas]);

  const entityTypeColorMap = useMemo(() => {
    const m = new Map<string, string>();
    projectEntityTypes.forEach((t, i) => m.set(t.id, SCHEMA_COLORS[i % SCHEMA_COLORS.length]!));
    return m;
  }, [projectEntityTypes]);

  useEffect(() => {
    if (pendingDialog !== 'add-entity') return;
    setAddEntityOpen(true);
  }, [pendingDialog]);

  if (isLoading) {
    return (
      <div className={styles.screen}>
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Loading project...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.screen}>
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Project not found</div>
        </div>
      </div>
    );
  }

  const allFiles = [
    ...project.files.rootFiles,
    ...project.files.folders.flatMap(f => f.files)
  ];

  const activeFolder = contentFolderFilter
    ? project.files.folders.find(f => f.path === contentFolderFilter)
    : null;

  const visibleFiles = activeFolder ? activeFolder.files : allFiles;

  const handleTogglePinned = async () => {
    setPinError('');
    updateProject.mutate(
      {
        projectId: project.public_id,
        data: {
          name: project.name,
          description: project.description,
          owner: project.owner?.id ?? null,
          pinned: !project.pinned
        }
      },
      {
        onError: err => {
          setPinError(err instanceof ApiError ? err.message : 'Could not update project status');
        }
      }
    );
  };

  const handleNavigateHome = () => {
    navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } });
  };

  const handleNavigateProject = () => {
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
        tab: search.tab,
        section: 'home',
        dialog: undefined,
        contentQuery: search.contentQuery,
        contentView: search.contentView
      })
    );
  };

  const setFilter = (value: string) => {
    navigate({
      search: previous => ({
        ...previous,
        contentQuery: value === '' ? undefined : value
      }),
      replace: true
    });
  };

  const setViewMode = (value: 'grid' | 'list') => {
    navigate({
      search: previous => ({
        ...previous,
        contentView: value === 'grid' ? undefined : value
      })
    });
  };

  const handleNavigateDiagram = (diagramId: string) => {
    navigate(projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), diagramId));
  };

  const handleNavigateMarkdown = (nodeId: string, mode: 'edit' | 'preview' = 'preview') => {
    navigate(projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), nodeId, { mode }));
  };

  const closeAddEntityDialog = () => {
    setAddEntityOpen(false);
    if (pendingDialog !== 'add-entity') return;
    navigate({
      ...projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
        tab: search.tab,
        folder: folderFilter ?? undefined,
        section,
        dialog: undefined,
        contentQuery: search.contentQuery,
        contentView: search.contentView
      }),
      replace: true
    });
  };

  const openContextMenu = (e: React.MouseEvent, target: ProjectMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, target });
  };

  const handleToggleTemplate = (file: ProjectFile, isWorkspaceTemplate: boolean = false) => {
    if (isWorkspaceTemplate) {
      // Toggle workspace template status
      const newIsWorkspaceTemplate = !file.is_workspace_template;
      toggleTemplateStatusMutation.mutate(
        {
          filePath: file.path,
          isTemplate: newIsWorkspaceTemplate, // Must be template if workspace template
          isWorkspaceTemplate: newIsWorkspaceTemplate
        },
        {
          onSuccess: () => setMenu(null) // Close menu to force re-render with fresh data
        }
      );
    } else {
      // Toggle project template status
      // If currently a workspace template, switch to project template (don't toggle off)
      const isCurrentlyProjectTemplate = file.is_template && !file.is_workspace_template;
      const newIsTemplate = !isCurrentlyProjectTemplate;
      toggleTemplateStatusMutation.mutate(
        {
          filePath: file.path,
          isTemplate: newIsTemplate,
          isWorkspaceTemplate: false // Project templates are not workspace templates
        },
        {
          onSuccess: () => setMenu(null) // Close menu to force re-render with fresh data
        }
      );
    }
  };

  const renderMoveToSubmenu = (
    file: ProjectFile,
    folders: string[],
    currentFolder: string | null
  ) => {
    const folderTree = buildFolderTree(folders.map(path => ({ path })));

    const renderFolderNodes = (nodes: FolderTreeNode[]): React.ReactNode => {
      return nodes.map(node => {
        const isCurrentFolder = node.path === currentFolder;
        if (node.children.length > 0) {
          return (
            <Menu.SubMenu key={node.path} label={node.name} leftSlot={<TbFolder size={13} />}>
              <Menu.Item
                leftSlot={<TbFolder size={13} />}
                disabled={isCurrentFolder}
                onClick={() => moveFileMutation.mutate({ file, targetFolder: node.path })}
              >
                {node.name}
              </Menu.Item>
              {renderFolderNodes(node.children)}
            </Menu.SubMenu>
          );
        }
        return (
          <Menu.Item
            key={node.path}
            leftSlot={<TbFolder size={13} />}
            disabled={isCurrentFolder}
            onClick={() => moveFileMutation.mutate({ file, targetFolder: node.path })}
          >
            {node.name}
          </Menu.Item>
        );
      });
    };

    return (
      <>
        <Menu.Item
          leftSlot={<TbFolderOpen size={13} />}
          disabled={currentFolder === null}
          onClick={() => moveFileMutation.mutate({ file, targetFolder: null })}
        >
          Root
        </Menu.Item>
        {folderTree.length > 0 && renderFolderNodes(folderTree)}
      </>
    );
  };

  const renderDiagramMenu = (file: ProjectFile) => {
    const currentFolder = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/'))
      : null;

    const allFolders = project.files.folders
      .map(f => f.path)
      .filter(path => path !== currentFolder);

    return (
      <>
        <Menu.Item leftSlot={<TbCopy size={13} />} onClick={() => cloneFileMutation.mutate(file)}>
          Clone
        </Menu.Item>
        <Menu.Item
          leftSlot={<TbPencil size={13} />}
          onClick={() => setRenameTarget({ type: 'diagram', file })}
        >
          Rename
        </Menu.Item>
        <Menu.Separator />
        <Menu.SubMenu label="Move to…" leftSlot={<TbFolderOpen size={13} />}>
          {renderMoveToSubmenu(file, allFolders, currentFolder)}
        </Menu.SubMenu>
        <Menu.SubMenu label="Template…" leftSlot={<TbStar size={13} />}>
          <Menu.CheckboxItem
            checked={file.is_workspace_template === true}
            onCheckedChange={() => handleToggleTemplate(file, true)}
          >
            Workspace Template
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={file.is_template === true && file.is_workspace_template !== true}
            onCheckedChange={() => handleToggleTemplate(file, false)}
          >
            Project Template
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={file.is_template !== true && file.is_workspace_template !== true}
            onCheckedChange={() => {
              setMenu(null);
              toggleTemplateStatusMutation.mutate({
                filePath: file.path,
                isTemplate: false,
                isWorkspaceTemplate: false
              });
            }}
          >
            None
          </Menu.CheckboxItem>
        </Menu.SubMenu>
        <Menu.Separator />
        <Menu.Item
          type="danger"
          leftSlot={<TbTrash size={13} />}
          onClick={() => setDeleteTarget({ type: 'diagram', file })}
        >
          Delete
        </Menu.Item>
      </>
    );
  };

  const renderMarkdownMenu = (file: ProjectFile) => {
    const currentFolder = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/'))
      : null;

    const allFolders = project.files.folders
      .map(f => f.path)
      .filter(path => path !== currentFolder);

    return (
      <>
        <Menu.Item
          leftSlot={<TbPencil size={13} />}
          onClick={() => setRenameTarget({ type: 'markdown', file })}
        >
          Rename
        </Menu.Item>
        <Menu.Separator />
        <Menu.SubMenu label="Move to…" leftSlot={<TbFolderOpen size={13} />}>
          {renderMoveToSubmenu(file, allFolders, currentFolder)}
        </Menu.SubMenu>
        <Menu.Separator />
        <Menu.Item
          type="danger"
          leftSlot={<TbTrash size={13} />}
          onClick={() => setDeleteTarget({ type: 'markdown', file })}
        >
          Delete
        </Menu.Item>
      </>
    );
  };

  const triggerDownload = (file: ProjectFile) => {
    const a = document.createElement('a');
    a.href = `/api/${workspaceId}/projects/${projectId}/files/download?path=${encodeURIComponent(file.path)}`;
    a.download = file.original_filename ?? file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderFileMenu = (file: ProjectFile) => {
    const currentFolder = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/'))
      : null;

    const allFolders = project.files.folders
      .map(f => f.path)
      .filter(path => path !== currentFolder);

    return (
      <>
        <Menu.Item
          leftSlot={<TbDownload size={13} />}
          onClick={() => {
            setMenu(null);
            triggerDownload(file);
          }}
        >
          Download
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item
          leftSlot={<TbPencil size={13} />}
          onClick={() => setRenameTarget({ type: 'file', file })}
        >
          Rename
        </Menu.Item>
        <Menu.Separator />
        <Menu.SubMenu label="Move to…" leftSlot={<TbFolderOpen size={13} />}>
          {renderMoveToSubmenu(file, allFolders, currentFolder)}
        </Menu.SubMenu>
        <Menu.Separator />
        <Menu.Item
          type="danger"
          leftSlot={<TbTrash size={13} />}
          onClick={() => setDeleteTarget({ type: 'file', file })}
        >
          Delete
        </Menu.Item>
      </>
    );
  };

  const renderFolderMenu = (path: string) => (
    <>
      <Menu.Item
        leftSlot={<TbPlus size={13} />}
        onClick={() => {
          setAddDiagramFolder(path);
          setAddDiagramOpen(true);
        }}
      >
        New diagram
      </Menu.Item>
      <Menu.Item
        leftSlot={<TbFolderOpen size={13} />}
        onClick={() => {
          setAddFolderParent(path);
          setAddFolderOpen(true);
        }}
      >
        New folder
      </Menu.Item>
      <Menu.Item
        leftSlot={<TbFileText size={13} />}
        onClick={() => {
          setAddMarkdownFolder(path);
          setAddMarkdownOpen(true);
        }}
      >
        New wiki page
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item
        leftSlot={<TbPencil size={13} />}
        onClick={() => setRenameTarget({ type: 'folder', path })}
      >
        Rename
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item
        type="danger"
        leftSlot={<TbTrash size={13} />}
        onClick={() => setDeleteTarget({ type: 'folder', path })}
      >
        Delete
      </Menu.Item>
    </>
  );

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type !== 'folder') {
      deleteFileMutation.mutate(deleteTarget.file.path);
    } else {
      deleteFolderMutation.mutate(deleteTarget.path);
    }
    setDeleteTarget(null);
  };

  const handleRenameConfirm = (newName: string) => {
    if (!renameTarget) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenameTarget(null);
      return;
    }
    if (renameTarget.type === 'file') {
      if (trimmed !== renameTarget.file.name) {
        renameBinaryFileMutation.mutate({ file: renameTarget.file, newName: trimmed });
      }
    } else if (renameTarget.type !== 'folder') {
      if (trimmed !== renameTarget.file.name) {
        renameFileMutation.mutate({ file: renameTarget.file, newName: trimmed });
      }
    } else {
      if (trimmed !== renameTarget.path) {
        renameFolderMutation.mutate({ oldPath: renameTarget.path, newPath: trimmed });
      }
    }
    setRenameTarget(null);
  };

  return (
    <>
      {section === 'assessments' && search.assessmentId ? (
        <AssessmentDetailsScreen
          key={search.assessmentId}
          project={project}
          projectId={projectId}
          assessmentId={search.assessmentId}
          initialTab={search.assessmentTab}
          onNavigateHome={handleNavigateHome}
          onNavigateProject={handleNavigateProject}
          onBack={() =>
            navigate({
              search: previous => ({
                ...previous,
                assessmentId: undefined
              })
            })
          }
        />
      ) : section === 'assessments' ? (
        <ProjectAssessments
          project={project}
          projectId={projectId}
          onNavigateHome={handleNavigateHome}
          onNavigateProject={handleNavigateProject}
        />
      ) : section === 'entities' ? (
        <ProjectEntities
          project={project}
          projectEntities={projectEntities}
          projectSnapshots={projectSnapshots}
          futureSnapshots={futureSnapshots}
          schemaMap={schemaMap}
          entityTypeColorMap={entityTypeColorMap}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          teams={teams}
          onNavigateHome={handleNavigateHome}
          onNavigateProject={handleNavigateProject}
          onAddEntity={() => setAddEntityOpen(true)}
          onToggleDone={(entityId, isDone) =>
            updateEntityMutation.mutate({ entityId, is_done: !isDone })
          }
          onRemoveEntity={entityId => removeEntityMutation.mutate(entityId)}
          onPlanFutureChange={entityId => setPlanEntityId(entityId)}
          onApplySnapshot={snap => setApplySnapshot(snap)}
        />
      ) : contentFolderFilter ? (
        <ProjectContent
          project={project}
          folderPath={contentFolderFilter}
          visibleFiles={visibleFiles}
          allFilesCount={allFiles.length}
          folderCount={project.files.folders.length}
          filter={filter}
          viewMode={viewMode}
          onNavigateHome={handleNavigateHome}
          onNavigateProject={handleNavigateProject}
          onSetFilter={setFilter}
          onSetViewMode={setViewMode}
          onOpenDiagram={handleNavigateDiagram}
          onOpenMarkdown={handleNavigateMarkdown}
          onDownloadFile={triggerDownload}
          onAddFolder={() => setAddFolderOpen(true)}
          onAddDiagram={() => {
            setAddDiagramFolder(contentFolderFilter);
            setAddDiagramOpen(true);
          }}
          onAddMarkdown={project.canManageFiles ? () => {
            setAddMarkdownFolder(contentFolderFilter);
            setAddMarkdownOpen(true);
          } : undefined}
          onUploadFile={project.canManageFiles ? () => {
            mainAreaFileInputRef.current?.click();
          } : undefined}
          onContextMenu={project.canManageFiles ? openContextMenu : undefined}
        />
      ) : (
        <ProjectDetails
          project={project}
          visibleFiles={visibleFiles}
          allFilesCount={allFiles.length}
          folderCount={project.files.folders.length}
          filter={filter}
          viewMode={viewMode}
          pinError={pinError}
          isUpdatingProject={updateProject.isPending}
          onNavigateHome={handleNavigateHome}
          onNavigateProject={handleNavigateProject}
          onTogglePinned={handleTogglePinned}
          onEdit={() => setEditing(true)}
          onSetFilter={setFilter}
          onSetViewMode={setViewMode}
          onOpenDiagram={handleNavigateDiagram}
          onOpenMarkdown={handleNavigateMarkdown}
          onDownloadFile={triggerDownload}
          onAddFolder={() => setAddFolderOpen(true)}
          onAddDiagram={() => {
            setAddDiagramFolder(contentFolderFilter);
            setAddDiagramOpen(true);
          }}
          onAddMarkdown={project.canManageFiles ? () => {
            setAddMarkdownFolder(contentFolderFilter);
            setAddMarkdownOpen(true);
          } : undefined}
          onUploadFile={project.canManageFiles ? () => {
            mainAreaFileInputRef.current?.click();
          } : undefined}
          onContextMenu={project.canManageFiles ? openContextMenu : undefined}
        />
      )}

      {editing && project.canEdit && (
        <ProjectSettingsForm
          project={project}
          workspaceId={workspaceId}
          teams={teams}
          onSaved={() => {
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
          onDelete={handleNavigateHome}
        />
      )}

      {project.canManageFiles && (
        <AddFolderDialog
          open={addFolderOpen}
          onClose={() => {
            setAddFolderOpen(false);
            setAddFolderParent(null);
          }}
          onCreated={() => {
            setMenu(null);
          }}
          workspaceId={workspaceId}
          projectId={projectId}
          parentFolder={addFolderParent ?? undefined}
        />
      )}
      {project.canManageFiles && (
        <AddDiagramDialog
          open={addDiagramOpen}
          onClose={() => {
            setAddDiagramOpen(false);
            setAddDiagramFolder(null);
          }}
          onCreated={() => {}}
          workspaceId={workspaceId}
          context="project"
          projectId={projectId}
          projectName={project.name}
          folder={addDiagramFolder}
        />
      )}
      {project.canManageFiles && (
        <AddMarkdownDialog
          open={addMarkdownOpen}
          onClose={() => {
            setAddMarkdownOpen(false);
            setAddMarkdownFolder(null);
          }}
          onCreated={file => handleNavigateMarkdown(file.id, 'edit')}
          onCreate={name => createMarkdownMutation.mutateAsync({ name, folder: addMarkdownFolder })}
          isPending={createMarkdownMutation.isPending}
        />
      )}

      {project.canManageFiles && (
        <input
          ref={mainAreaFileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) {
              uploadFileMutation.mutate({ file: f, folder: contentFolderFilter });
            }
            e.target.value = '';
          }}
        />
      )}

      {addEntityOpen && (
        <AddEntityToProjectDialog
          open={addEntityOpen}
          onClose={closeAddEntityDialog}
          workspaceId={workspaceId}
          projectId={projectId}
          projectEntityTypes={projectEntityTypes}
          addEntityMutation={addEntityMutation}
        />
      )}

      {menu && (
        <ContextMenu.Imperative x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          {menu.target.type === 'diagram'
            ? renderDiagramMenu(menu.target.file)
            : menu.target.type === 'markdown'
              ? renderMarkdownMenu(menu.target.file)
              : menu.target.type === 'file'
                ? renderFileMenu(menu.target.file)
                : renderFolderMenu(menu.target.path)}
        </ContextMenu.Imperative>
      )}

      {planEntityId && (
        <PlanFutureChangeDialog
          open={!!planEntityId}
          workspaceId={workspaceId}
          projectId={projectId}
          entityId={planEntityId}
          schemas={schemas}
          teams={teams}
          lifecycleStates={lifecycleStates}
          onClose={() => setPlanEntityId(null)}
        />
      )}

      {applySnapshot && (
        <ApplySnapshotDialog
          open={!!applySnapshot}
          snapshot={applySnapshot}
          workspaceId={workspaceId}
          projectId={projectId}
          schemas={schemas}
          onClose={() => setApplySnapshot(null)}
        />
      )}

      <RenameDialog
        open={!!renameTarget}
        currentName={
          renameTarget
            ? renameTarget.type !== 'folder'
              ? renameTarget.file.name
              : renameTarget.path
            : ''
        }
        entityType={renameTarget ? entityTypeLabel(renameTarget.type) : 'diagram'}
        onRename={handleRenameConfirm}
        onCancel={() => setRenameTarget(null)}
      />

      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title={deleteTarget ? deleteTitle(deleteTarget.type) : ''}
        message={deleteTarget ? deleteMessage(deleteTarget) : ''}
        detail="This can't be undone."
        confirmLabel={deleteTarget ? deleteConfirmLabel(deleteTarget.type) : ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
