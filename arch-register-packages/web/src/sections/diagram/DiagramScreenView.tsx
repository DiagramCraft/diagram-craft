import { TbArrowLeft } from 'react-icons/tb';
import { EmbeddableEditor } from '@diagram-craft/main/EmbeddableEditor';
import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { LoadingState } from '../../components/LoadingState';
import { initializeDiagramCraft } from '../../diagramcraft-initial-config';
import styles from './DiagramScreen.module.css';

export const DiagramScreenView = ({
  workspaceId,
  loading,
  error,
  fileInfo,
  doc,
  dirty,
  onDirtyChange,
  onClose
}: {
  workspaceId: string;
  loading: boolean;
  error: string | null;
  fileInfo: { path: string; name: string } | null;
  doc: DiagramDocument | null;
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}) => {
  const { documentFactory, diagramFactory } = initializeDiagramCraft(workspaceId);
  if (loading) {
    return (
      <div className={styles.diagramScreen}>
        <div className={styles.loading}>
          <LoadingState text="Loading diagram..." />
        </div>
      </div>
    );
  }
  if (error || !fileInfo || !doc) {
    return (
      <div className={styles.diagramScreen}>
        <div className={styles.error}>
          <p>Error: {error ?? 'Failed to load diagram'}</p>
          <button type="button" onClick={onClose} className={styles.button}>
            Back to Project
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={`dc ${styles.diagramScreen}`}>
      <EmbeddableEditor
        doc={doc}
        documentFactory={documentFactory}
        diagramFactory={diagramFactory}
        documentName={fileInfo.name}
        dirty={dirty}
        onDirtyChange={onDirtyChange}
        headerLeft={
          <button type="button" className="embeddable-back-button" onClick={onClose} title="Back">
            <TbArrowLeft size="13px" />
            <span>Back</span>
          </button>
        }
      />
    </div>
  );
};
