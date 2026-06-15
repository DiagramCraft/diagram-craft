import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbFileText, TbFolderOpen, TbPlus, TbUpload } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { FileEntry } from '../../lib/api';
import styles from './ProjectDetailScreen.module.css';
import { DiagramBrowserToolbar } from '../../components/diagram-browser/DiagramBrowserView';
import { ProjectDiagramsView, type ProjectMenuTarget } from './ProjectDiagramsView';
import { ProjectMetaItem, ProjectScreenLayout } from './ProjectScreenLayout';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';

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
  onUploadFile,
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
  onUploadFile?: () => void;
  onContextMenu?: (e: React.MouseEvent, target: ProjectMenuTarget) => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null);

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
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setNewMenu({ x: rect.right, y: rect.bottom });
              }}
            >
              New
            </Button>
            {newMenu && (
              <ContextMenu.Imperative x={newMenu.x} y={newMenu.y} align="right" onClose={() => setNewMenu(null)}>
                <Menu.Item
                  leftSlot={<TbFolderOpen size={13} />}
                  onClick={() => { setNewMenu(null); onAddFolder(); }}
                >
                  New folder
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbUpload size={13} />}
                  onClick={() => { setNewMenu(null); onUploadFile?.(); }}
                >
                  Upload file
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbPlus size={13} />}
                  onClick={() => { setNewMenu(null); onAddDiagram(); }}
                >
                  New diagram
                </Menu.Item>
                {onAddMarkdown && (
                  <Menu.Item
                    leftSlot={<TbFileText size={13} />}
                    onClick={() => { setNewMenu(null); onAddMarkdown(); }}
                  >
                    New wiki page
                  </Menu.Item>
                )}
              </ContextMenu.Imperative>
            )}
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
        onContextMenu={onContextMenu}
      />
    </ProjectScreenLayout>
  );
};
