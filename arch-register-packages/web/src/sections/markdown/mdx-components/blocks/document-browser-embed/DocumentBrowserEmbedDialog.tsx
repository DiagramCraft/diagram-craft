import { useMemo, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogContent } from '../../../editor/BlockDialog';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import {
  DocumentBrowserEmbedConfigForm,
  sanitizeConditions,
  fieldsForType
} from './DocumentBrowserEmbedConfigForm';
import { useDocumentTypes } from '../../../../../hooks/useDocuments';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import {
  decodeDocumentBrowserEmbedConfig,
  encodeDocumentBrowserEmbedConfig
} from './DocumentBrowserEmbedCodec';
import {
  DOCUMENT_BROWSER_BASE_COLUMN_IDS,
  type DocumentBrowserEmbedConfig,
  type DocumentBrowserEmbedSlateElement
} from './types';
import styles from './DocumentBrowserEmbedDialog.module.css';

const DEFAULT_CONFIG: DocumentBrowserEmbedConfig = {
  q: '',
  conditions: [],
  sort: 'updated_at',
  sortDir: 'desc',
  visibleBaseColumnIds: [...DOCUMENT_BROWSER_BASE_COLUMN_IDS],
  visibleFieldIds: []
};

export const DocumentBrowserEmbedDialog = ({
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
  const { data: documentTypes = [] } = useDocumentTypes(workspaceSlug);
  const initialConfig = useMemo(
    () => decodeDocumentBrowserEmbedConfig((element as DocumentBrowserEmbedSlateElement).config),
    [element]
  );
  const [config, setConfig] = useState<DocumentBrowserEmbedConfig>(initialConfig ?? DEFAULT_CONFIG);

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    const selectedFields = fieldsForType(documentTypes, config.documentTypeId);
    const snapshot: DocumentBrowserEmbedConfig = {
      ...config,
      conditions: sanitizeConditions(config.conditions, selectedFields),
      visibleFieldIds: config.visibleFieldIds.filter(id =>
        selectedFields.some(field => field.id === id)
      )
    };
    editor.tf.setNodes({ config: encodeDocumentBrowserEmbedConfig(snapshot) }, { at: path });
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
      title="Document browser"
      width="min(1200px, 92vw)"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DocumentBrowserEmbedConfigForm value={config} onChange={setConfig} />
        <div className={styles.preview}>
          <DocumentBrowserEmbed config={encodeDocumentBrowserEmbedConfig(config)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
