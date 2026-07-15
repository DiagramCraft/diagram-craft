import { useState } from 'react';
import { TbChartLine, TbChevronDown, TbChevronRight, TbFolder } from 'react-icons/tb';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import styles from './DiagramPicker.module.css';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

const DiagramRow = ({
  file,
  selected,
  onSelect
}: {
  file: ProjectFile;
  selected: boolean;
  onSelect: (file: ProjectFile) => void;
}) => (
  <button
    type="button"
    className={`${styles.diagramRow} ${selected ? styles.selected : ''}`}
    onClick={() => onSelect(file)}
  >
    <TbChartLine size={14} />
    {file.name}
  </button>
);

const FolderSection = ({
  name,
  files,
  selectedId,
  onSelect
}: {
  name: string;
  files: ProjectFile[];
  selectedId: string;
  onSelect: (file: ProjectFile) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className={styles.folder}>
      <button type="button" className={styles.folderRow} onClick={() => setExpanded(e => !e)}>
        {expanded ? <TbChevronDown size={13} /> : <TbChevronRight size={13} />}
        <TbFolder size={14} />
        {name}
      </button>
      {expanded && (
        <div className={styles.folderFiles}>
          {files.map(file => (
            <DiagramRow
              key={file.id}
              file={file}
              selected={file.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DiagramPicker = ({
  fileTree,
  selectedId,
  onSelect
}: {
  fileTree: FileTree | undefined;
  selectedId: string;
  onSelect: (file: ProjectFile) => void;
}) => {
  if (!fileTree) {
    return <LoadingState text="Loading…" size="sm" />;
  }

  const rootDiagrams = fileTree.rootFiles.filter(f => f.type === 'diagram');
  const foldersWithDiagrams = fileTree.folders
    .map(folder => ({ ...folder, files: folder.files.filter(f => f.type === 'diagram') }))
    .filter(folder => folder.files.length > 0);

  if (rootDiagrams.length === 0 && foldersWithDiagrams.length === 0) {
    return <EmptyState compact title="No diagrams found" />;
  }

  return (
    <div className={styles.tree}>
      {foldersWithDiagrams.map(folder => (
        <FolderSection
          key={folder.path}
          name={folder.name}
          files={folder.files}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
      {rootDiagrams.map(file => (
        <DiagramRow
          key={file.id}
          file={file}
          selected={file.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};
