import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { useEntities } from '../../hooks/useEntities';
import styles from './ProjectDetailScreen.module.css';
import { AddFolderDialog } from './AddFolderDialog';
import { AddDiagramDialog } from './AddDiagramDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { ColorPicker } from '../../components/ColorPicker';
import { TbPlus, TbFolder, TbFolderOpen, TbTrash, TbCopy, TbStar, TbPencil } from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/api';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { ApiError, FileEntry, WorkspaceTeam } from '../../lib/api';
import {
  useProject,
  useUpdateProject,
  useDeleteProject,
  useProjectEntities,
  useAddProjectEntity,
  useUpdateProjectEntity,
  useRemoveProjectEntity
} from '../../hooks/useProjects';
import { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import {
  useDeleteProjectFile,
  useDeleteProjectFolder,
  useRenameProjectFolder,
  useCloneProjectFile,
  useRenameProjectFile,
  useMoveProjectFile,
  useToggleTemplateStatus
} from '../../hooks/useProjectFiles';
import { ProjectContent } from './ProjectContent';
import { ProjectDetails } from './ProjectDetails';
import { ProjectEntities } from './ProjectEntities';
import type { ProjectMenuTarget } from './ProjectDiagramsView';

const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' }
] as const;

type ProjectSection = 'home' | 'entities';

export const ProjectDetailScreen = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const search = useSearch({ strict: false }) as {
    tab?: string;
    folder?: string;
    section?: ProjectSection;
    dialog?: 'add-entity';
  };
  const { workspaceSlug, teams, projectEntityTypes, schemas } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const folderFilter = search.folder ?? null;
  const section: ProjectSection = search.section === 'entities' ? 'entities' : 'home';
  const pendingDialog = search.dialog;
  const contentFolderFilter = section === 'home' ? folderFilter : null;

  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addFolderParent, setAddFolderParent] = useState<string | null>(null);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addDiagramFolder, setAddDiagramFolder] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');
  const [addEntityOpen, setAddEntityOpen] = useState(false);

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
  const moveFileMutation = useMoveProjectFile(workspaceId, projectId);
  const toggleTemplateStatusMutation = useToggleTemplateStatus(workspaceId, projectId);

  // Entity hooks
  const { data: projectEntities = [] } = useProjectEntities(workspaceId, projectId);
  const addEntityMutation = useAddProjectEntity(workspaceId, projectId);
  const updateEntityMutation = useUpdateProjectEntity(workspaceId, projectId);
  const removeEntityMutation = useRemoveProjectEntity(workspaceId, projectId);

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
        projectId: project.id,
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
    navigate({
      to: '/$workspaceSlug/projects/$projectId',
      params: { workspaceSlug, projectId },
      search: {
        tab: search.tab as 'projects' | 'archive' | undefined,
        section: 'home',
        dialog: undefined
      }
    });
  };

  const handleNavigateDiagram = (diagramId: string) => {
    navigate({
      to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
      params: { workspaceSlug, projectId, diagramId }
    });
  };

  const closeAddEntityDialog = () => {
    setAddEntityOpen(false);
    if (pendingDialog !== 'add-entity') return;
    navigate({
      to: '/$workspaceSlug/projects/$projectId',
      params: { workspaceSlug, projectId },
      search: {
        tab: search.tab as 'projects' | 'archive' | undefined,
        folder: folderFilter ?? undefined,
        section,
        dialog: undefined
      },
      replace: true
    });
  };

  const openContextMenu = (e: React.MouseEvent, target: ProjectMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, target });
  };

  const handleToggleTemplate = (file: FileEntry, isWorkspaceTemplate: boolean = false) => {
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

  type FolderNode = {
    path: string;
    name: string;
    children: FolderNode[];
  };

  const buildFolderTree = (folders: string[]): FolderNode[] => {
    const root: FolderNode[] = [];
    const map = new Map<string, FolderNode>();

    // Sort folders to ensure parents come before children
    const sorted = [...folders].sort();

    for (const path of sorted) {
      const parts = path.split('/');
      const name = parts[parts.length - 1] ?? path;
      const node: FolderNode = { path, name, children: [] };
      map.set(path, node);

      if (parts.length === 1) {
        // Top-level folder
        root.push(node);
      } else {
        // Nested folder - find parent
        const parentPath = parts.slice(0, -1).join('/');
        const parent = map.get(parentPath);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    return root;
  };

  const renderMoveToSubmenu = (
    file: FileEntry,
    folders: string[],
    currentFolder: string | null
  ) => {
    const folderTree = buildFolderTree(folders);

    const renderFolderNodes = (nodes: FolderNode[]): React.ReactNode => {
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

  const renderDiagramMenu = (file: FileEntry) => {
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
    if (deleteTarget.type === 'diagram') {
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
    if (renameTarget.type === 'diagram') {
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
      {section === 'entities' ? (
        <ProjectEntities
          project={project}
          projectEntities={projectEntities}
          schemaMap={schemaMap}
          entityTypeColorMap={entityTypeColorMap}
          onNavigateHome={handleNavigateHome}
          onNavigateProject={handleNavigateProject}
          onAddEntity={() => setAddEntityOpen(true)}
          onToggleDone={(entityId, isDone) =>
            updateEntityMutation.mutate({ entityId, is_done: !isDone })
          }
          onRemoveEntity={entityId => removeEntityMutation.mutate(entityId)}
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
          onAddFolder={() => setAddFolderOpen(true)}
          onAddDiagram={() => {
            setAddDiagramFolder(contentFolderFilter);
            setAddDiagramOpen(true);
          }}
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
          onAddFolder={() => setAddFolderOpen(true)}
          onAddDiagram={() => {
            setAddDiagramFolder(contentFolderFilter);
            setAddDiagramOpen(true);
          }}
          onContextMenu={project.canManageFiles ? openContextMenu : undefined}
        />
      )}

      {editing && project.canEdit && (
        <ProjectSettings
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
            : renderFolderMenu(menu.target.path)}
        </ContextMenu.Imperative>
      )}

      <RenameDialog
        open={!!renameTarget}
        currentName={
          renameTarget
            ? renameTarget.type === 'diagram'
              ? renameTarget.file.name
              : renameTarget.path
            : ''
        }
        entityType={renameTarget?.type === 'folder' ? 'folder' : 'diagram'}
        onRename={handleRenameConfirm}
        onCancel={() => setRenameTarget(null)}
      />

      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'folder' ? 'Delete folder?' : 'Delete diagram?'}
        message={
          deleteTarget ? (
            deleteTarget.type === 'folder' ? (
              <>
                The folder <b>{deleteTarget.path}</b> and all diagrams inside it will be permanently
                deleted.
              </>
            ) : (
              <>
                The diagram <b>{deleteTarget.file.name}</b> will be permanently deleted.
              </>
            )
          ) : (
            ''
          )
        }
        detail="This can't be undone."
        confirmLabel={deleteTarget?.type === 'folder' ? 'Delete folder' : 'Delete diagram'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

const RenameDialog = ({
  open,
  currentName,
  entityType,
  onRename,
  onCancel
}: {
  open: boolean;
  currentName: string;
  entityType: 'diagram' | 'folder';
  onRename: (newName: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      }, 0);
    }
  }, [open, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onRename(trimmed);
  };

  return (
    <Dialog open={open} onClose={onCancel} title={`Rename ${entityType}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--base-fg-more-dim)' }}>Name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              fontSize: 13,
              padding: '6px 8px',
              background: 'var(--base-bg)',
              border: '1px solid var(--cmp-border)',
              borderRadius: 'var(--r)',
              color: 'var(--base-fg)',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            onClick={e => {
              e.preventDefault();
              const trimmed = name.trim();
              if (trimmed) onRename(trimmed);
            }}
            disabled={!name.trim()}
          >
            Rename
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

const ProjectSettings = ({
  project,
  workspaceId,
  teams,
  onSaved,
  onClose,
  onDelete
}: {
  project: ProjectDetailData;
  workspaceId: string;
  teams: WorkspaceTeam[];
  onSaved: () => void;
  onClose: () => void;
  onDelete: () => void;
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [owner, setOwner] = useState(project.owner?.id ?? '');
  const [status, setStatus] = useState(project.status);
  const [color, setColor] = useState<string | null>(project.color ?? null);
  const [targetDate, setTargetDate] = useState(project.target_date ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateProject = useUpdateProject(workspaceId);
  const deleteProject = useDeleteProject(workspaceId);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description);
    setOwner(project.owner?.id ?? '');
    setStatus(project.status);
    setColor(project.color ?? null);
    setTargetDate(project.target_date ?? '');
    setError('');
  }, [project]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError('');
    updateProject.mutate(
      {
        projectId: project.id,
        data: {
          name: trimmed,
          description: description.trim(),
          owner: owner || null,
          status,
          color,
          target_date: targetDate || null
        }
      },
      {
        onSuccess: () => onSaved(),
        onError: err => {
          setError(err instanceof ApiError ? err.message : 'Something went wrong');
        }
      }
    );
  };

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  const doDelete = () => {
    setConfirmDelete(false);
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        onDelete();
        onSaved();
      },
      onError: err => {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
      }
    });
  };

  return (
    <Dialog open={true} onClose={onClose} title="Edit project">
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Name</label>
        <input className={styles.formInput} value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Description</label>
        <textarea
          className={`${styles.formInput} ${styles.formTextarea}`}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Status</label>
        <select
          className={styles.formInput}
          value={status}
          onChange={e => setStatus(e.target.value as 'draft' | 'active' | 'complete' | 'cancelled')}
        >
          {PROJECT_STATUSES.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Owner</label>
        <select className={styles.formInput} value={owner} onChange={e => setOwner(e.target.value)}>
          <option value="">No owner</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Color</label>
        <ColorPicker value={color} onChange={setColor} size="small" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Target date</label>
        <input
          className={styles.formInput}
          type="date"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
        />
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--error-fg)' }}>{error}</div>}
      <div className={styles.formActions}>
        <Button variant="danger" icon={<TbTrash size={12} />} onClick={handleDelete}>
          Delete project
        </Button>
        <div className={styles.formSpacer} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={updateProject.isPending}>
          {updateProject.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete project?"
        message={
          <>
            The project <b>{project.name}</b> and all its diagrams will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete project"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Dialog>
  );
};

type AddEntityMutation = ReturnType<typeof useAddProjectEntity>;

const AddEntityToProjectDialog = ({
  open,
  onClose,
  workspaceId,
  projectEntityTypes,
  addEntityMutation
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  projectEntityTypes: { id: string; label: string }[];
  addEntityMutation: AddEntityMutation;
}) => {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: allResults = [] } = useEntities(workspaceId, {
    view: 'summary',
    limit: 200
  });

  const filtered = allResults.filter(e => {
    if (!q.trim()) return true;
    const lower = q.toLowerCase();
    return (`${e._name} ${e._slug}`).toLowerCase().includes(lower);
  });

  // Auto-select first result
  useEffect(() => {
    if (filtered.length > 0 && (!selectedId || !filtered.find(e => e._uid === selectedId))) {
      setSelectedId(filtered[0]!._uid);
    }
    if (filtered.length === 0) setSelectedId('');
  }, [filtered, selectedId]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSelectedId('');
      setEntityType('');
      setError('');
      setTimeout(() => searchRef.current?.focus(), 40);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!selectedId) {
      setError('Please select an entity');
      return;
    }
    try {
      await addEntityMutation.mutateAsync({
        entity_id: selectedId,
        entity_type: entityType || null
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }, [selectedId, addEntityMutation, onClose, entityType]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!filtered.length) return;
        const idx = filtered.findIndex(e => e._uid === selectedId);
        const next =
          ev.key === 'ArrowDown' ? Math.min(idx + 1, filtered.length - 1) : Math.max(idx - 1, 0);
        setSelectedId(filtered[next]!._uid);
      }
      if (ev.key === 'Enter' && selectedId) {
        ev.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, filtered, selectedId, handleSubmit]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add entity to project"
      width={500}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: addEntityMutation.isPending ? 'Adding...' : 'Add entity',
          type: 'default',
          disabled: addEntityMutation.isPending || !selectedId,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <div className={styles.aedBody}>
        {/* SEARCH */}
        <div className={styles.aedSection}>
          <div className={styles.aedLabel}>Search</div>
          <TextInput
            ref={searchRef}
            variant="search"
            value={q}
            placeholder="Type to search entities…"
            onChange={v => setQ(v ?? '')}
            onClear={() => setQ('')}
            autoComplete="off"
            style={{ width: '100%' }}
          />
        </div>

        {/* ENTITY listbox */}
        <div className={styles.aedSection}>
          <div className={styles.aedLabel}>Entity</div>
          <div className={styles.aedList}>
            {filtered.length === 0 ? (
              <div className={styles.aedListEmpty}>
                {q ? 'No entities match that search.' : 'No entities found.'}
              </div>
            ) : (
              filtered.map(e => (
                <button
                  key={e._uid}
                  type="button"
                  className={`${styles.aedItem} ${selectedId === e._uid ? styles.aedItemSelected : ''}`}
                  onClick={() => setSelectedId(e._uid)}
                >
                  <span className={styles.aedItemName}>{e._name || e._slug}</span>
                  <span className={styles.aedItemType}>{e._schema?.name ?? ''}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ROLE */}
        <div className={styles.aedSection}>
          <div className={styles.aedLabel}>Role</div>
          <Select.Root value={entityType} placeholder="None" onChange={v => setEntityType(v ?? '')}>
            <Select.Item value="">None</Select.Item>
            {projectEntityTypes.map(t => (
              <Select.Item key={t.id} value={t.id}>
                {t.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--error-fg)' }}>{error}</div>}
      </div>
    </Dialog>
  );
};
