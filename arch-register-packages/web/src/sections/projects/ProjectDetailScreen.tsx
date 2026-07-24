import styles from './ProjectDetailScreen.module.css';
import { AddFolderDialog } from './AddFolderDialog';
import { AddDiagramDialog } from './AddDiagramDialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import {
  TbPlus,
  TbFileText,
  TbFolder,
  TbFolderOpen,
  TbTrash,
  TbCopy,
  TbStar,
  TbPencil,
  TbDownload
} from 'react-icons/tb';
import { ApiError } from '../../lib/http';
import { downloadUrl } from '../../lib/browserDownload';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import {
  asProjectPublicId,
  projectContentFolderRoute,
  projectDetailRoute,
  projectDiagramRoute,
  projectMarkdownRoute,
  projectMarkdownDraftRoute
} from '../../routes/publicObjectRoutes';
import { ProjectContent } from './ProjectContent';
import { ProjectDetails } from './ProjectDetails';
import { ProjectEntities } from './ProjectEntities';
import { ProjectAssessments } from './ProjectAssessments';
import { AssessmentDetailsScreen } from './AssessmentDetailsScreen';
import { ProjectMilestones } from './ProjectMilestones';
import {
  deleteConfirmLabel,
  deleteMessage,
  deleteTitle,
  entityTypeLabel,
  type MenuTarget as ProjectMenuTarget
} from '../../lib/contentNode';
import { RenameDialog } from '../../components/RenameDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { AddEntityToProjectDialog } from './components/AddEntityToProjectDialog';
import { ProjectSettingsForm } from './components/ProjectSettingsForm';
import { PlanChangeDialog } from './components/PlanChangeDialog';
import { ApplyChangeCaseDialog } from './components/ApplyChangeCaseDialog';
import { buildFolderTree, type FolderTreeNode } from '../../lib/folderTree';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { useProjectDetailController } from './useProjectDetailController';

export const ProjectDetailScreen = ({ folder }: { folder?: string } = {}) => {
  const {
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
    contentOperations,
    toggleTemplateStatusMutation,
    mainAreaFileInputRef,
    projectEntities,
    updateEntityMutation,
    removeEntityMutation,
    changeCases,
    schemaMap,
    entityTypeColorMap,
    allFiles,
    visibleFiles
  } = useProjectDetailController(folder);

  if (isLoading) {
    return (
      <div className={styles.screen}>
        <LoadingState text="Loading project..." />
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.screen}>
        <EmptyState framed title="Project not found" />
      </div>
    );
  }

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
    const route = folderFilter
      ? projectContentFolderRoute(workspaceSlug, asProjectPublicId(projectId), folderFilter)
      : projectDetailRoute(workspaceSlug, asProjectPublicId(projectId));
    navigate({
      ...route,
      search: {
        ...search,
        contentQuery: value === '' ? undefined : value
      },
      replace: true
    });
  };

  const setViewMode = (value: 'grid' | 'list') => {
    const route = folderFilter
      ? projectContentFolderRoute(workspaceSlug, asProjectPublicId(projectId), folderFilter)
      : projectDetailRoute(workspaceSlug, asProjectPublicId(projectId));
    navigate({
      ...route,
      search: {
        ...search,
        contentView: value === 'grid' ? undefined : value
      }
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
    const nextSearch = {
      tab: search.tab === 'archive' ? search.tab : undefined,
      section: section === 'home' ? undefined : section,
      dialog: undefined,
      contentQuery: search.contentQuery,
      contentView: search.contentView
    };
    const nextLocation = folderFilter
      ? projectContentFolderRoute(
          workspaceSlug,
          asProjectPublicId(projectId),
          folderFilter,
          nextSearch
        )
      : projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), nextSearch);
    navigate({ ...nextLocation, replace: true });
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
                onClick={() => contentOperations.moveFile.mutate({ file, targetFolder: node.path })}
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
            onClick={() => contentOperations.moveFile.mutate({ file, targetFolder: node.path })}
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
          onClick={() => contentOperations.moveFile.mutate({ file, targetFolder: null })}
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
        <Menu.Item
          leftSlot={<TbCopy size={13} />}
          onClick={() => contentOperations.cloneFile.mutate(file)}
        >
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
    downloadUrl(
      `/api/${workspaceId}/projects/${projectId}/files/download?path=${encodeURIComponent(file.path)}`,
      file.original_filename ?? file.name
    );
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
      contentOperations.deleteFile.mutate(deleteTarget.file.path);
    } else {
      contentOperations.deleteFolder.mutate(deleteTarget.path);
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
        contentOperations.renameFile.mutate({ file: renameTarget.file, newName: trimmed });
      }
    } else if (renameTarget.type !== 'folder') {
      if (trimmed !== renameTarget.file.name) {
        contentOperations.renameFile.mutate({ file: renameTarget.file, newName: trimmed });
      }
    } else {
      if (trimmed !== renameTarget.path) {
        contentOperations.renameFolder.mutate({ oldPath: renameTarget.path, newPath: trimmed });
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
              ...(folder
                ? projectContentFolderRoute(workspaceSlug, asProjectPublicId(projectId), folder)
                : projectDetailRoute(workspaceSlug, asProjectPublicId(projectId))),
              search: { ...search, assessmentId: undefined }
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
      ) : section === 'milestones' ? (
        <ProjectMilestones
          project={project}
          projectId={projectId}
          onNavigateHome={handleNavigateHome}
          onNavigateProject={handleNavigateProject}
        />
      ) : section === 'entities' ? (
        <ProjectEntities
          project={project}
          projectEntities={projectEntities}
          changeCases={changeCases}
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
          onPlanFutureChange={entityId => setPlanDialog({ mode: 'create', entityId })}
          onPlanChange={() => setPlanDialog({ mode: 'create' })}
          onApplySnapshot={entry => setApplyCaseId(entry.changeCase.id)}
          onEditSnapshot={entry => setPlanDialog({ mode: 'edit', caseId: entry.changeCase.id })}
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
          onAddFolder={() => {
            setAddFolderParent(contentFolderFilter);
            setAddFolderOpen(true);
          }}
          onAddDiagram={() => {
            setAddDiagramFolder(contentFolderFilter);
            setAddDiagramOpen(true);
          }}
          onAddMarkdown={
            project.canManageFiles
              ? () => {
                  setAddMarkdownFolder(contentFolderFilter);
                  setAddMarkdownOpen(true);
                }
              : undefined
          }
          onUploadFile={
            project.canManageFiles
              ? () => {
                  mainAreaFileInputRef.current?.click();
                }
              : undefined
          }
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
          onAddFolder={() => {
            setAddFolderParent(contentFolderFilter);
            setAddFolderOpen(true);
          }}
          onAddDiagram={() => {
            setAddDiagramFolder(contentFolderFilter);
            setAddDiagramOpen(true);
          }}
          onAddMarkdown={
            project.canManageFiles
              ? () => {
                  setAddMarkdownFolder(contentFolderFilter);
                  setAddMarkdownOpen(true);
                }
              : undefined
          }
          onUploadFile={
            project.canManageFiles
              ? () => {
                  mainAreaFileInputRef.current?.click();
                }
              : undefined
          }
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
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onCreated={file => handleNavigateMarkdown(file.id, 'edit')}
          onOpenDraft={draft =>
            navigate(
              projectMarkdownDraftRoute(workspaceSlug, asProjectPublicId(projectId), {
                draftName: draft.name,
                draftFolder: addMarkdownFolder ?? undefined,
                draftType: draft.documentTypeId ?? undefined,
                draftTemplate: draft.templateId ?? undefined
              })
            )
          }
          onCreate={name =>
            contentOperations.createMarkdown.mutateAsync({ name, folder: addMarkdownFolder })
          }
          isPending={contentOperations.createMarkdown.isPending}
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
              contentOperations.upload.mutate({ file: f, folder: contentFolderFilter });
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

      {planDialog && (
        <PlanChangeDialog
          open={!!planDialog}
          workspaceId={workspaceId}
          projectId={projectId}
          schemas={schemas}
          teams={teams}
          lifecycleStates={lifecycleStates}
          initialEntityId={planDialog.mode === 'create' ? planDialog.entityId : undefined}
          editCaseId={planDialog.mode === 'edit' ? planDialog.caseId : undefined}
          onClose={() => setPlanDialog(null)}
        />
      )}

      {applyCaseId && (
        <ApplyChangeCaseDialog
          open={!!applyCaseId}
          workspaceId={workspaceId}
          projectId={projectId}
          caseId={applyCaseId}
          schemas={schemas}
          onClose={() => setApplyCaseId(null)}
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
