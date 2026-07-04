import type React from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbFolder, TbLayoutGrid, TbList, TbPlus } from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { DiagramCard, DiagramRow } from '../DiagramCard';
import styles from '../../sections/projects/ProjectDetailScreen.module.css';

export type DiagramViewMode = 'grid' | 'list';

export type DiagramBrowserItem = {
  file: ProjectFile;
  folder?: string;
};

export type DiagramBrowserGridSection = {
  key: string;
  items: DiagramBrowserItem[];
  label?: React.ReactNode;
  showAddButton?: boolean;
};

const DiagramBrowserEmptyState = ({
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
    {actionLabel ? (
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
  </div>
);

const AddDiagramCard = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    className={`${styles.diagramCard} ${styles.diagramCardAdd}`}
    onClick={onClick}
  >
    <TbPlus size={16} />
    New diagram
  </button>
);

export const DiagramBrowserToolbar = ({
  label,
  filter,
  onFilterChange,
  viewMode,
  onViewModeChange
}: {
  label?: React.ReactNode;
  filter: string;
  onFilterChange: (value: string) => void;
  viewMode: DiagramViewMode;
  onViewModeChange: (value: DiagramViewMode) => void;
}) => (
  <div className={styles.tabBar}>
    {label}
    <div className={styles.tabBarRight}>
      <TextInput
        variant="search"
        placeholder="Filter diagrams…"
        value={filter}
        onChange={value => onFilterChange(value ?? '')}
        onClear={() => onFilterChange('')}
      />
      <button
        type="button"
        className={`${styles.iconBtn} ${viewMode === 'grid' ? styles.iconBtnActive : ''}`}
        title="Grid view"
        onClick={() => onViewModeChange('grid')}
      >
        <TbLayoutGrid size={13} />
      </button>
      <button
        type="button"
        className={`${styles.iconBtn} ${viewMode === 'list' ? styles.iconBtnActive : ''}`}
        title="List view"
        onClick={() => onViewModeChange('list')}
      >
        <TbList size={13} />
      </button>
    </div>
  </div>
);

export const DiagramBrowserView = ({
  hasFilter,
  viewMode,
  listItems,
  gridSections,
  onOpenDiagram,
  onOpenMarkdown,
  onDownloadFile,
  onContextMenu,
  onNewDiagram,
  emptyState,
  noMatchState
}: {
  hasFilter: boolean;
  viewMode: DiagramViewMode;
  listItems: DiagramBrowserItem[];
  gridSections: DiagramBrowserGridSection[];
  onOpenDiagram: (file: ProjectFile) => void;
  onOpenMarkdown?: (file: ProjectFile) => void;
  onDownloadFile?: (file: ProjectFile) => void;
  onContextMenu?: (event: React.MouseEvent, file: ProjectFile) => void;
  onNewDiagram?: () => void;
  emptyState: { title: string; sub: string };
  noMatchState: { title: string; sub: string };
}) => {
  const totalItems = listItems.length;

  if (totalItems === 0 && !hasFilter) {
    return (
      <DiagramBrowserEmptyState
        title={emptyState.title}
        sub={emptyState.sub}
        actionLabel={onNewDiagram ? 'New diagram' : undefined}
        onAction={onNewDiagram}
      />
    );
  }

  if (totalItems === 0) {
    return <DiagramBrowserEmptyState title={noMatchState.title} sub={noMatchState.sub} />;
  }

  const renderItem = ({ file, folder }: DiagramBrowserItem) => ({
    file,
    folder,
    onOpen: () =>
      file.type === 'file'
        ? onDownloadFile?.(file)
        : file.type === 'markdown' && onOpenMarkdown
          ? onOpenMarkdown(file)
          : onOpenDiagram(file),
    onContextMenu: onContextMenu
      ? (event: React.MouseEvent) => onContextMenu(event, file)
      : undefined
  });

  if (viewMode === 'list') {
    return (
      <div className={styles.diagramListPanel}>
        <div className={styles.diagramListHead}>
          <span>Name</span>
          <span>Folder</span>
          <span>Last edit</span>
        </div>
        {listItems.map(item => (
          <DiagramRow key={item.file.path} {...renderItem(item)} />
        ))}
      </div>
    );
  }

  return (
    <>
      {gridSections.map(section => (
        <div key={section.key}>
          {section.label ? <div className={styles.sectionLabel}>{section.label}</div> : null}
          <div className={styles.diagramGrid}>
            {section.items.map(item => (
              <DiagramCard key={item.file.path} {...renderItem(item)} />
            ))}
            {section.showAddButton && onNewDiagram ? <AddDiagramCard onClick={onNewDiagram} /> : null}
          </div>
        </div>
      ))}
    </>
  );
};

export const DiagramBrowserFolderLabel = ({ folder }: { folder: string }) => (
  <>
    <TbFolder size={11} /> {folder}
  </>
);
