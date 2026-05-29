import { useState } from 'react';
import styles from './ProjectDetail.module.css';
import { AddFolderDialog } from '../dialogs/AddFolderDialog';
import { AddDiagramDialog } from '../dialogs/AddDiagramDialog';
import { Dialog } from '../components/Dialog';
import {
  TbPlus, TbFolder, TbFolderOpen, TbSearch,
  TbLayoutGrid, TbList, TbTrash, TbPencil, TbStar,
} from 'react-icons/tb';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { ApiError } from '../api';
import type { ProjectDetail as ProjectDetailData, FileEntry, WorkspaceTeam } from '../api';
import { useProject, useUpdateProject, useDeleteProject } from '../hooks/useProjects';

const PROJECT_STATUSES = [
  { value: 'pinned', label: 'Pinned' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

export const ProjectDetail = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const search = useSearch({ strict: false }) as { tab?: string; folder?: string };
  const { workspaceSlug, teams } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const folderFilter = search.folder ?? null;

  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [pinError, setPinError] = useState('');

  // Query hooks
  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const updateProject = useUpdateProject(workspaceId);

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
    ...project.files.folders.flatMap(f => f.files),
  ].filter(f => !f.path.endsWith('/.keep'));

  const activeFolder = folderFilter
    ? project.files.folders.find(f => f.path === folderFilter)
    : null;

  const visibleFiles = activeFolder
    ? activeFolder.files.filter(f => !f.path.endsWith('/.keep'))
    : allFiles;

  const handleTogglePinned = async () => {
    const nextStatus = project.status === 'pinned' ? 'active' : 'pinned';

    setPinError('');
    updateProject.mutate(
      {
        projectId: project.id,
        data: {
          name: project.name,
          description: project.description,
          owner: project.owner,
          status: nextStatus,
        },
      },
      {
        onError: (err) => {
          setPinError(err instanceof ApiError ? err.message : 'Could not update project status');
        },
      }
    );
  };

  const handleNavigateHome = () => {
    navigate({ to: '/$workspaceSlug', params: { workspaceSlug } });
  };

  const handleNavigateProject = () => {
    navigate({ to: '/$workspaceSlug/projects/$projectId', params: { workspaceSlug, projectId }, search: { tab: search.tab as 'projects' | 'archive' | undefined } });
  };

  const handleNavigateDiagram = (diagramId: string) => {
    navigate({ to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId', params: { workspaceSlug, projectId, diagramId } });
  };

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <button type="button" onClick={handleNavigateHome}>Projects</button>
            {' / '}
            <button type="button" onClick={handleNavigateProject}>{project.name}</button>
            {folderFilter && <>{' / '}{folderFilter}</>}
          </div>
          <div className={styles.titleRow}>
            <div className={styles.title}>{folderFilter ?? project.name}</div>
            {!folderFilter && project.status !== 'archived' && project.canEdit && (
              <button
                type="button"
                className={`${styles.pinBtn} ${project.status === 'pinned' ? styles.pinBtnActive : ''}`}
                onClick={handleTogglePinned}
                disabled={updateProject.isPending}
                title={project.status === 'pinned' ? 'Unpin project' : 'Pin project'}
                aria-label={project.status === 'pinned' ? 'Unpin project' : 'Pin project'}
              >
                <TbStar size={16} />
              </button>
            )}
          </div>
          {project.description && (
            <div className={styles.sub}>{project.description}</div>
          )}
          {pinError && (
            <div className={styles.errorText}>{pinError}</div>
          )}
        </div>
        <div className={styles.actions}>
          {!folderFilter && project.canEdit && (
            <button type="button" className={styles.btn} onClick={() => setEditing(true)}>
              <TbPencil size={12} /> Edit
            </button>
          )}
          {project.canManageFiles && (
            <button type="button" className={styles.btn} onClick={() => setAddFolderOpen(true)}>
              <TbFolderOpen size={12} /> New folder
            </button>
          )}
          {project.canManageFiles && (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setAddDiagramOpen(true)}>
              <TbPlus size={12} /> New diagram
            </button>
          )}
        </div>
      </div>

      {/* Meta bar */}
      <div className={styles.meta}>
        <MetaItem label="Diagrams" value={<span className="mono tabular">{allFiles.length}</span>} />
        <MetaItem
          label="Folders"
          value={<span className="mono tabular">{project.files.folders.length}</span>}
        />
        <MetaItem
          label="Owner"
          value={project.owner ?? '—'}
        />
        <MetaItem
          label="Last edit"
          value={new Date(project.updated_at).toLocaleDateString()}
        />
      </div>

      {/* Toolbar */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          <div className={`${styles.tab} ${styles.tabActive}`}>
            Diagrams ({visibleFiles.length})
          </div>
        </div>
        <div className={styles.tabBarRight}>
          <div className={styles.searchInline}>
            <TbSearch size={11} />
            <input
              placeholder="Filter diagrams…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`${styles.iconBtn} ${viewMode === 'grid' ? styles.iconBtnActive : ''}`}
            title="Grid view"
            onClick={() => setViewMode('grid')}
          >
            <TbLayoutGrid size={13} />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${viewMode === 'list' ? styles.iconBtnActive : ''}`}
            title="List view"
            onClick={() => setViewMode('list')}
          >
            <TbList size={13} />
          </button>
        </div>
      </div>

      <DiagramsView
        project={project}
        visibleFiles={visibleFiles}
        folderFilter={folderFilter}
        filter={filter}
        viewMode={viewMode}
        onOpenDiagram={handleNavigateDiagram}
        onNewDiagram={project.canManageFiles ? () => setAddDiagramOpen(true) : undefined}
      />

      {editing && project.canEdit && (
        <ProjectSettings
          project={project}
          workspaceId={workspaceId}
          teams={teams}
          onSaved={() => { setEditing(false); }}
          onClose={() => setEditing(false)}
          onDelete={handleNavigateHome}
        />
      )}

      {project.canManageFiles && (
        <AddFolderDialog
          open={addFolderOpen}
          onClose={() => setAddFolderOpen(false)}
          onCreated={() => {}}
          workspaceId={workspaceId}
          projectId={projectId}
        />
      )}
      {project.canManageFiles && (
        <AddDiagramDialog
          open={addDiagramOpen}
          onClose={() => setAddDiagramOpen(false)}
          onCreated={() => {}}
          workspaceId={workspaceId}
          projectId={projectId}
          folder={folderFilter}
        />
      )}
    </div>
  );
};

const MetaItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className={styles.metaItem}>
    <div className={styles.metaLabel}>{label}</div>
    <div className={styles.metaValue}>{value}</div>
  </div>
);

const DiagramCard = ({
  file,
  folder,
  onOpen,
}: {
  file: FileEntry;
  folder?: string;
  onOpen: () => void;
}) => (
  <button type="button" className={styles.diagramCard} onClick={onOpen}>
    <div className={styles.diagramThumb}>
      <div className={styles.diagramThumbGrid} />
      <div className={styles.diagramThumbNodes}>
        <svg viewBox="0 0 140 80" preserveAspectRatio="none">
          <rect x="10" y="14" width="32" height="18" rx="2" fill="var(--bg-3)" stroke="var(--border-strong)" />
          <rect x="56" y="6" width="32" height="18" rx="2" fill="var(--bg-3)" stroke="var(--border-strong)" />
          <rect x="56" y="44" width="32" height="18" rx="2" fill="var(--bg-3)" stroke="var(--border-strong)" />
          <rect x="100" y="26" width="32" height="18" rx="2" fill="color-mix(in oklch, var(--tag-component) 28%, var(--bg-3))" stroke="var(--tag-component)" />
          <path d="M42 23 L56 15 M42 23 L56 53 M88 15 L100 35 M88 53 L100 35"
            stroke="var(--fg-3)" fill="none" />
        </svg>
      </div>
    </div>
    <div className={styles.diagramMeta}>
      <div className={styles.diagramName}>{file.name}</div>
      <div className={styles.diagramSub}>
        {folder && <><TbFolder size={10} /> {folder} &middot; </>}
        {new Date(file.updated_at).toLocaleDateString()}
      </div>
    </div>
  </button>
);

const EmptyState = ({
  title,
  sub,
  actionLabel,
  onAction,
}: {
  title: string;
  sub: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon}>
      <TbPlus size={18} />
    </div>
    <div className={styles.emptyTitle}>{title}</div>
    <div className={styles.emptySub}>{sub}</div>
    {actionLabel && (
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

const DiagramRow = ({
  file,
  folder,
  onOpen,
}: {
  file: FileEntry;
  folder?: string;
  onOpen: () => void;
}) => (
  <button type="button" className={styles.diagramRow} onClick={onOpen}>
    <div className={styles.diagramRowName}>{file.name}</div>
    <div className={styles.diagramRowFolder}>
      {folder && <><TbFolder size={10} /> {folder}</>}
    </div>
    <div className={styles.diagramRowDate}>
      {new Date(file.updated_at).toLocaleDateString()}
    </div>
  </button>
);

const DiagramsView = ({
  project,
  visibleFiles,
  folderFilter,
  filter,
  viewMode,
  onOpenDiagram,
  onNewDiagram,
}: {
  project: ProjectDetailData;
  visibleFiles: FileEntry[];
  folderFilter: string | null;
  filter: string;
  viewMode: 'grid' | 'list';
  onOpenDiagram: (diagramId: string) => void;
  onNewDiagram?: () => void;
}) => {
  const lc = filter.toLowerCase();
  const filtered = lc
    ? visibleFiles.filter(f => f.name.toLowerCase().includes(lc))
    : visibleFiles;

  if (filtered.length === 0 && !filter) {
    return (
      <EmptyState
        title={folderFilter ? 'No diagrams in this folder' : 'No diagrams yet'}
        sub="Create your first diagram to get started."
        actionLabel={onNewDiagram ? 'New diagram' : undefined}
        onAction={onNewDiagram}
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No matches"
        sub={`No diagrams match "${filter}".`}
      />
    );
  }

  const FileItem = viewMode === 'list' ? DiagramRow : DiagramCard;
  const containerClass = viewMode === 'list' ? styles.diagramList : styles.diagramGrid;

  const addButton = onNewDiagram == null ? null : viewMode === 'list' ? (
    <button type="button" className={styles.diagramRowAdd} onClick={onNewDiagram}>
      <TbPlus size={12} /> New diagram
    </button>
  ) : (
    <button type="button" className={`${styles.diagramCard} ${styles.diagramCardAdd}`} onClick={onNewDiagram}>
      <TbPlus size={16} />
      New diagram
    </button>
  );

  if (folderFilter) {
    return (
      <div className={containerClass}>
        {filtered.map(f => (
          <FileItem
            key={f.id}
            file={f}
            onOpen={() => onOpenDiagram(f.id)}
          />
        ))}
        {addButton}
      </div>
    );
  }

  const rootFiles = project.files.rootFiles
    .filter(f => !f.path.endsWith('/.keep'))
    .filter(f => !lc || f.name.toLowerCase().includes(lc));

  const folderGroups = project.files.folders
    .map(folder => ({
      path: folder.path,
      files: folder.files
        .filter(f => !f.path.endsWith('/.keep'))
        .filter(f => !lc || f.name.toLowerCase().includes(lc)),
    }))
    .filter(g => g.files.length > 0);

  return (
    <>
      {rootFiles.length > 0 && (
        <div className={containerClass}>
          {rootFiles.map(f => (
            <FileItem
              key={f.id}
              file={f}
              onOpen={() => onOpenDiagram(f.id)}
            />
          ))}
        </div>
      )}
      {folderGroups.map(g => (
        <div key={g.path}>
          <div className={styles.sectionLabel}>
            <TbFolder size={11} /> {g.path}
          </div>
          <div className={containerClass}>
            {g.files.map(f => (
              <FileItem
                key={f.id}
                file={f}
                folder={g.path}
                onOpen={() => onOpenDiagram(f.id)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className={containerClass} style={{ marginTop: folderGroups.length > 0 || rootFiles.length > 0 ? 8 : 0 }}>
        {addButton}
      </div>
    </>
  );
};

const ProjectSettings = ({
  project,
  workspaceId,
  teams,
  onSaved,
  onClose,
  onDelete,
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
  const [owner, setOwner] = useState(project.owner ?? '');
  const [status, setStatus] = useState(project.status);
  const [error, setError] = useState('');

  const updateProject = useUpdateProject(workspaceId);
  const deleteProject = useDeleteProject(workspaceId);

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
        },
      },
      {
        onSuccess: () => onSaved(),
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : 'Something went wrong');
        },
      }
    );
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project and all its files?')) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        onDelete();
        onSaved();
      },
      onError: (err) => {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
      },
    });
  };

  return (
    <Dialog open={true} onClose={onClose} title="Edit project">
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Name</label>
        <input
          className={styles.formInput}
          value={name}
          onChange={e => setName(e.target.value)}
        />
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
          onChange={e => setStatus(e.target.value as 'pinned' | 'active' | 'archived')}
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
        <select
          className={styles.formInput}
          value={owner}
          onChange={e => setOwner(e.target.value)}
        >
          <option value="">No owner</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.id}
            </option>
          ))}
        </select>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      <div className={styles.formActions}>
        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>
          <TbTrash size={12} /> Delete project
        </button>
        <div className={styles.formSpacer} />
        <button
          type="button"
          className={styles.btn}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSave}
          disabled={updateProject.isPending}
        >
          {updateProject.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Dialog>
  );
};
