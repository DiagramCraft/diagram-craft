import type React from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { DiagramCard, DiagramRow } from '../../components/DiagramCard';
import { TbFolder, TbPlus } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { FileEntry } from '../../lib/api';
import styles from './ProjectDetailScreen.module.css';

export type ProjectMenuTarget =
  | { type: 'diagram'; file: FileEntry }
  | { type: 'folder'; path: string };

const EmptyState = ({
  title,
  sub,
  actionLabel,
  onAction
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
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export const ProjectDiagramsView = ({
  project,
  visibleFiles,
  folderFilter,
  filter,
  viewMode,
  onOpenDiagram,
  onNewDiagram,
  onContextMenu
}: {
  project: ProjectDetailData;
  visibleFiles: FileEntry[];
  folderFilter: string | null;
  filter: string;
  viewMode: 'grid' | 'list';
  onOpenDiagram: (diagramId: string) => void;
  onNewDiagram?: () => void;
  onContextMenu?: (e: React.MouseEvent, target: ProjectMenuTarget) => void;
}) => {
  const lc = filter.toLowerCase();
  const filtered = lc ? visibleFiles.filter(f => f.name.toLowerCase().includes(lc)) : visibleFiles;

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
    return <EmptyState title="No matches" sub={`No diagrams match "${filter}".`} />;
  }

  const fileItemProps = (file: FileEntry, folder?: string) => ({
    file,
    folder,
    onOpen: () => onOpenDiagram(file.id),
    onContextMenu: onContextMenu
      ? (e: React.MouseEvent) => onContextMenu(e, { type: 'diagram', file })
      : undefined
  });

  if (viewMode === 'list') {
    const allItems: Array<{ file: FileEntry; folder?: string }> = folderFilter
      ? filtered.map(file => ({ file }))
      : [
          ...project.files.rootFiles
            .filter(file => !lc || file.name.toLowerCase().includes(lc))
            .map(file => ({ file })),
          ...project.files.folders.flatMap(folder =>
            folder.files
              .filter(file => !lc || file.name.toLowerCase().includes(lc))
              .map(file => ({ file, folder: folder.path }))
          )
        ];

    return (
      <div className={styles.diagramListPanel}>
        <div className={styles.diagramListHead}>
          <span>Name</span>
          <span>Folder</span>
          <span>Last edit</span>
        </div>
        {allItems.map(({ file, folder }) => (
          <DiagramRow key={file.path} {...fileItemProps(file, folder)} />
        ))}
      </div>
    );
  }

  const addButton =
    onNewDiagram == null ? null : (
      <button
        type="button"
        className={`${styles.diagramCard} ${styles.diagramCardAdd}`}
        onClick={onNewDiagram}
      >
        <TbPlus size={16} />
        New diagram
      </button>
    );

  if (folderFilter) {
    return (
      <div className={styles.diagramGrid}>
        {filtered.map(file => (
          <DiagramCard key={file.path} {...fileItemProps(file)} />
        ))}
        {addButton}
      </div>
    );
  }

  const rootFiles = project.files.rootFiles.filter(file => !lc || file.name.toLowerCase().includes(lc));

  const folderGroups = project.files.folders
    .map(folder => ({
      path: folder.path,
      files: folder.files.filter(file => !lc || file.name.toLowerCase().includes(lc))
    }))
    .filter(group => group.files.length > 0);

  return (
    <>
      {rootFiles.length > 0 && (
        <div className={styles.diagramGrid}>
          {rootFiles.map(file => (
            <DiagramCard key={file.path} {...fileItemProps(file)} />
          ))}
          {folderGroups.length === 0 && addButton}
        </div>
      )}
      {folderGroups.map((group, index) => (
        <div key={group.path}>
          <div className={styles.sectionLabel}>
            <TbFolder size={11} /> {group.path}
          </div>
          <div className={styles.diagramGrid}>
            {group.files.map(file => (
              <DiagramCard key={file.path} {...fileItemProps(file, group.path)} />
            ))}
            {index === folderGroups.length - 1 && addButton}
          </div>
        </div>
      ))}
      {rootFiles.length === 0 && folderGroups.length === 0 && (
        <div className={styles.diagramGrid}>{addButton}</div>
      )}
    </>
  );
};
