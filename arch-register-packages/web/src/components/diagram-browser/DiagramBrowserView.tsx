import type React from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbFolder, TbPlus } from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { DiagramCard, DiagramRow } from '../DiagramCard';
import { EmptyState } from '../EmptyState';
import { FilterDropdown } from '../FilterDropdown';
import { SearchInput } from '../SearchInput';
import toolbarStyles from './DiagramBrowserToolbar.module.css';
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
  <EmptyState
    framed
    icon={<TbPlus size={18} />}
    title={title}
    subtitle={sub}
    action={
      actionLabel ? (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null
    }
  />
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
  onViewModeChange,
  sort,
  onSortChange,
  sortOptions
}: {
  label?: React.ReactNode;
  filter: string;
  onFilterChange: (value: string) => void;
  viewMode: DiagramViewMode;
  onViewModeChange: (value: DiagramViewMode) => void;
  sort?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: { value: string; label: string }[];
}) => (
  <div className={toolbarStyles.toolbar}>
    {label}
    <SearchInput
      size="sm"
      className={toolbarStyles.search}
      placeholder="Filter diagrams…"
      value={filter}
      onChange={onFilterChange}
      onClear={() => onFilterChange('')}
    />
    <div className={toolbarStyles.spacer} />
    {sortOptions && sort !== undefined && onSortChange && (
      <FilterDropdown label="Sort" value={sort} onChange={onSortChange} options={sortOptions} />
    )}
    <FilterDropdown
      label="View"
      value={viewMode}
      onChange={value => onViewModeChange(value as DiagramViewMode)}
      options={[
        { value: 'grid', label: 'Grid' },
        { value: 'list', label: 'List' }
      ]}
    />
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
            {section.showAddButton && onNewDiagram ? (
              <AddDiagramCard onClick={onNewDiagram} />
            ) : null}
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
