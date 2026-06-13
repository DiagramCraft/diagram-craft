import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbFolderOpen, TbLayoutGrid, TbList, TbPlus } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { FileEntry } from '../../lib/api';
import styles from './ProjectDetailScreen.module.css';
import { ProjectDiagramsView, type ProjectMenuTarget } from './ProjectDiagramsView';
import { ProjectMetaItem, ProjectScreenLayout } from './ProjectScreenLayout';

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
  onAddFolder,
  onAddDiagram,
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
  onAddFolder: () => void;
  onAddDiagram: () => void;
  onContextMenu?: (e: React.MouseEvent, target: ProjectMenuTarget) => void;
}) => {
  return (
    <ProjectScreenLayout
      breadcrumbs={[
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
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={onAddDiagram}>
              New diagram
            </Button>
          </>
        ) : null
      }
      meta={
        <>
          <ProjectMetaItem label="Diagrams" value={<span className="mono tabular">{allFilesCount}</span>} />
          <ProjectMetaItem label="Folders" value={<span className="mono tabular">{folderCount}</span>} />
          <ProjectMetaItem label="Owner" value={project.owner?.name ?? '—'} />
          <ProjectMetaItem label="Last edit" value={new Date(project.updated_at).toLocaleDateString()} />
        </>
      }
      toolbar={
        <div className={styles.tabBar}>
          <div className={styles.sectionLabel} style={{ margin: 0 }}>
            {`Diagrams (${visibleFiles.length})`}
          </div>
          <div className={styles.tabBarRight}>
            <TextInput
              variant="search"
              placeholder="Filter diagrams…"
              value={filter}
              onChange={value => onSetFilter(value ?? '')}
              onClear={() => onSetFilter('')}
            />
            <button
              type="button"
              className={`${styles.iconBtn} ${viewMode === 'grid' ? styles.iconBtnActive : ''}`}
              title="Grid view"
              onClick={() => onSetViewMode('grid')}
            >
              <TbLayoutGrid size={13} />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${viewMode === 'list' ? styles.iconBtnActive : ''}`}
              title="List view"
              onClick={() => onSetViewMode('list')}
            >
              <TbList size={13} />
            </button>
          </div>
        </div>
      }
    >
      <ProjectDiagramsView
        project={project}
        visibleFiles={visibleFiles}
        folderFilter={folderPath}
        filter={filter}
        viewMode={viewMode}
        onOpenDiagram={onOpenDiagram}
        onNewDiagram={project.canManageFiles ? onAddDiagram : undefined}
        onContextMenu={onContextMenu}
      />
    </ProjectScreenLayout>
  );
};
