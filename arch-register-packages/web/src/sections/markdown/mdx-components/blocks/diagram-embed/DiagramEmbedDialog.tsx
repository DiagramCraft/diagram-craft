import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { useParams } from '@tanstack/react-router';
import { TbChartLine, TbChevronDown, TbChevronRight, TbFolder } from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntityContentNodes } from '../../../../../hooks/useProjects';
import {
  useProjectFiles,
  useWorkspaceContentNodes
} from '../../../../../hooks/useProjectFiles';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import type { DiagramEmbedSlateElement } from './types';
import styles from './DiagramEmbedDialog.module.css';

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
      <button
        type="button"
        className={styles.folderRow}
        onClick={() => setExpanded(e => !e)}
      >
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

const DiagramPicker = ({
  fileTree,
  selectedId,
  onSelect
}: {
  fileTree: FileTree | undefined;
  selectedId: string;
  onSelect: (file: ProjectFile) => void;
}) => {
  if (!fileTree) {
    return <div className={styles.empty}>Loading…</div>;
  }

  const rootDiagrams = fileTree.rootFiles.filter(f => f.type === 'diagram');
  const foldersWithDiagrams = fileTree.folders
    .map(folder => ({ ...folder, files: folder.files.filter(f => f.type === 'diagram') }))
    .filter(folder => folder.files.length > 0);

  if (rootDiagrams.length === 0 && foldersWithDiagrams.length === 0) {
    return <div className={styles.empty}>No diagrams found</div>;
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

export const DiagramEmbedDialog = ({
  element,
  open,
  onClose,
  isNew
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const { workspaceSlug } = useWorkspaceContext();
  const params = useParams({ strict: false }) as {
    projectId?: string;
    entityId?: string;
  };
  const { projectId, entityId } = params;

  const el = element as DiagramEmbedSlateElement;
  const [fileId, setFileId] = useState(el.fileId ?? '');
  const [caption, setCaption] = useState(el.caption ?? '');

  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', {
    enabled: !!entityId
  });
  // useProjectFiles is naturally disabled when projectId is '' (its own enabled guard)
  const { data: projectFiles } = useProjectFiles(workspaceSlug, projectId ?? '');
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, {
    enabled: !projectId && !entityId
  });

  const fileTree: FileTree | undefined = entityId
    ? entityFiles
    : projectId
      ? projectFiles
      : workspaceFiles;

  const handleSelectFile = (file: ProjectFile) => {
    setFileId(file.id);
  };

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!fileId || !path) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }
    editor.tf.setNodes(
      { fileId, caption: caption.trim() },
      { at: path }
    );
    onClose();
  };

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Diagram embed"
      width={480}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !fileId, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Diagram">
          <DiagramPicker fileTree={fileTree} selectedId={fileId} onSelect={handleSelectFile} />
        </DialogSection>
        <DialogSection label="Caption (optional)">
          <input
            className={styles.input}
            type="text"
            placeholder="Add a caption…"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
