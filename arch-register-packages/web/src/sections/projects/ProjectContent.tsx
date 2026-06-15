import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbFileText, TbFolderOpen, TbPlus } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { FileEntry } from '../../lib/api';
import styles from './ProjectDetailScreen.module.css';
import { DiagramBrowserToolbar } from '../../components/diagram-browser/DiagramBrowserView';
import { ProjectDiagramsView, type ProjectMenuTarget } from './ProjectDiagramsView';
import { ProjectMetaItem, ProjectScreenLayout } from './ProjectScreenLayout';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';

export const ProjectContent = ({
  project,
  folderPath,
  visibleFiles,
  allFilesCount,
  folderCount,
  filter,
  viewMode,
  onNavigateHome,
  onNavigateProject,
  onSetFilter,
  onSetViewMode,
  onOpenDiagram,
  onOpenMarkdown,
  onDownloadFile,
  onAddFolder,
  onAddDiagram,
  onAddMarkdown,
  onContextMenu
}: {
  project: ProjectDetailData;
  folderPath: string;
  visibleFiles: FileEntry[];
  allFilesCount: number;
  folderCount: number;
  filter: string;
  viewMode: 'grid' | 'list';
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onSetFilter: (value: string) => void;
  onSetViewMode: (value: 'grid' | 'list') => void;
  onOpenDiagram: (diagramId: string) => void;
  onOpenMarkdown?: (nodeId: string) => void;
  onDownloadFile?: (file: FileEntry) => void;
  onAddFolder: () => void;
  onAddDiagram: () => void;
  onAddMarkdown?: () => void;
  onContextMenu?: (e: React.MouseEvent, target: ProjectMenuTarget) => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  return (
    <ProjectScreenLayout
      breadcrumbs={[
        { label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }) },
        { label: 'Projects', onClick: onNavigateHome },
        { label: project.name, onClick: onNavigateProject },
        { label: folderPath }
      ]}
      title={folderPath}
      actions={
        project.canManageFiles ? (
          <>
            <Button icon={<TbFolderOpen size={12} />} onClick={onAddFolder}>
              New folder
            </Button>
            {onAddMarkdown && (
              <Button icon={<TbFileText size={12} />} onClick={onAddMarkdown}>
                New document
              </Button>
            )}
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={onAddDiagram}>
              New diagram
            </Button>
          </>
        ) : null
      }
      meta={
        <>
          <ProjectMetaItem label="Items" value={<span className="mono tabular">{allFilesCount}</span>} />
          <ProjectMetaItem label="Folders" value={<span className="mono tabular">{folderCount}</span>} />
          <ProjectMetaItem label="Owner" value={project.owner?.name ?? '—'} />
          <ProjectMetaItem label="Last edit" value={new Date(project.updated_at).toLocaleDateString()} />
        </>
      }
      toolbar={
        <DiagramBrowserToolbar
          label={<div className={styles.sectionLabel} style={{ margin: 0 }}>{`Content (${visibleFiles.length})`}</div>}
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
        folderFilter={folderPath}
        filter={filter}
        viewMode={viewMode}
        onOpenDiagram={onOpenDiagram}
        onOpenMarkdown={onOpenMarkdown}
        onDownloadFile={onDownloadFile}
        onNewDiagram={project.canManageFiles ? onAddDiagram : undefined}
        onContextMenu={onContextMenu}
      />
    </ProjectScreenLayout>
  );
};
