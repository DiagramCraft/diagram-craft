import { useMemo, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useMdxContext } from '../../../MdxContext';
import { EntityBrowserEmbedConfigForm } from './EntityBrowserEmbedConfigForm';
import type { EntityBrowserEmbedSlateElement } from './types';
import {
  decodeEntityBrowserEmbedConfig,
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';

export const EntityBrowserEmbedDialog = ({
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
  const el = element as EntityBrowserEmbedSlateElement;
  const { projectId } = useMdxContext();

  const initialConfig = useMemo(() => decodeEntityBrowserEmbedConfig(el.config), [el.config]);
  const [config, setConfig] = useState<EntityBrowserEmbedConfig>(
    initialConfig ?? {
      q: '',
      conditions: [],
      sort: 'name',
      view: 'table',
      viewConfigs: {},
      projectScope: projectId ? 'project' : 'all'
    }
  );

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    editor.tf.setNodes({ config: encodeEntityBrowserEmbedConfig(config) }, { at: path });
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
      title="Entity browser"
      width={'min(1200px, 92vw)'}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', onClick: handleConfirm }
      ]}
    >
      <EntityBrowserEmbedConfigForm
        projectId={projectId}
        initialConfig={initialConfig}
        onChange={setConfig}
      />
    </Dialog>
  );
};
