import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbFileText, TbFolderOpen, TbPencil, TbPlus, TbStar, TbUpload } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import styles from './ProjectDetailScreen.module.css';
import { DiagramBrowserToolbar } from '../../components/diagram-browser/DiagramBrowserView';
import { ProjectDiagramsView, type ProjectMenuTarget } from './ProjectDiagramsView';
import { ProjectMetaItem, ProjectScreenLayout } from './ProjectScreenLayout';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';

export const ProjectDetails = ({
  project,
  visibleFiles,
  allFilesCount,
  folderCount,
  filter,
  viewMode,
  pinError,
  isUpdatingProject,
  onNavigateHome,
  onNavigateProject,
  onTogglePinned,
  onEdit,
  onSetFilter,
  onSetViewMode,
  onOpenDiagram,
  onOpenMarkdown,
  onDownloadFile,
  onAddFolder,
  onAddDiagram,
  onAddMarkdown,
  onUploadFile,
  onContextMenu
}: {
  project: ProjectDetailData;
  visibleFiles: ProjectFile[];
  allFilesCount: number;
  folderCount: number;
  filter: string;
  viewMode: 'grid' | 'list';
  pinError: string;
  isUpdatingProject: boolean;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onTogglePinned: () => void;
  onEdit: () => void;
  onSetFilter: (value: string) => void;
  onSetViewMode: (value: 'grid' | 'list') => void;
  onOpenDiagram: (diagramId: string) => void;
  onOpenMarkdown?: (nodeId: string) => void;
  onDownloadFile?: (file: ProjectFile) => void;
  onAddFolder: () => void;
  onAddDiagram: () => void;
  onAddMarkdown?: () => void;
  onUploadFile?: () => void;
  onContextMenu?: (e: React.MouseEvent, target: ProjectMenuTarget) => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();

  return (
    <ProjectScreenLayout
      breadcrumbs={[
        { label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }) },
        { label: 'Projects', onClick: onNavigateHome },
        { label: project.name, onClick: onNavigateProject }
      ]}
      title={project.name}
      titleSuffix={
        project.canEdit ? (
          <button
            type="button"
            className={`${styles.pinBtn} ${project.pinned ? styles.pinBtnActive : ''}`}
            onClick={onTogglePinned}
            disabled={isUpdatingProject}
            title={project.pinned ? 'Unpin project' : 'Pin project'}
            aria-label={project.pinned ? 'Unpin project' : 'Pin project'}
          >
            <TbStar size={16} />
          </button>
        ) : null
      }
      description={project.description}
      error={pinError ? <div className={styles.errorText}>{pinError}</div> : undefined}
      actions={
        <>
          {project.canEdit && (
            <Button icon={<TbPencil size={12} />} onClick={onEdit}>
              Edit
            </Button>
          )}
          {project.canManageFiles && (
            <MenuButton.Root>
              <MenuButton.Trigger element={<Button variant="primary" icon={<TbPlus size={12} />}>New</Button>} />
              <MenuButton.Menu align="end">
                <Menu.Item leftSlot={<TbFolderOpen size={13} />} onClick={onAddFolder}>
                  New folder
                </Menu.Item>
                <Menu.Item leftSlot={<TbUpload size={13} />} onClick={() => onUploadFile?.()}>
                  Upload file
                </Menu.Item>
                <Menu.Item leftSlot={<TbPlus size={13} />} onClick={onAddDiagram}>
                  New diagram
                </Menu.Item>
                {onAddMarkdown && (
                  <Menu.Item leftSlot={<TbFileText size={13} />} onClick={onAddMarkdown}>
                    New wiki page
                  </Menu.Item>
                )}
              </MenuButton.Menu>
            </MenuButton.Root>
          )}
        </>
      }
      meta={
        <>
          <ProjectMetaItem label="Project ID" value={<span className="mono tabular">{project.public_id}</span>} />
          <ProjectMetaItem label="Diagrams" value={<span className="mono tabular">{allFilesCount}</span>} />
          <ProjectMetaItem label="Folders" value={<span className="mono tabular">{folderCount}</span>} />
          <ProjectMetaItem label="Owner" value={project.owner?.name ?? '—'} />
          <ProjectMetaItem label="Last edit" value={new Date(project.updated_at).toLocaleDateString()} />
        </>
      }
      toolbar={
        <DiagramBrowserToolbar
          label={<div className={styles.sectionLabel} style={{ margin: 0 }}>{`Diagrams (${visibleFiles.length})`}</div>}
          filter={filter}
          onFilterChange={onSetFilter}
          viewMode={viewMode}
          onViewModeChange={onSetViewMode}
        />
      }
    >
      <ProjectDiagramsView
        project={project}
        visibleFiles={visibleFiles}
        folderFilter={null}
        filter={filter}
        viewMode={viewMode}
        onOpenDiagram={onOpenDiagram}
        onOpenMarkdown={onOpenMarkdown}
        onDownloadFile={onDownloadFile}
        onContextMenu={onContextMenu}
      />
    </ProjectScreenLayout>
  );
};
