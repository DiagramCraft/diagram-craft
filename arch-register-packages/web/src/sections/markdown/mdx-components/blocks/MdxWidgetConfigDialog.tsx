import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogContent } from '../../editor/BlockDialog';
import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../MdxContext';

export type MdxConfigSpec<E extends TElement, Config extends Record<string, unknown>> = {
  title: string;
  width?: number | string;
  fromElement: (el: E) => Config;
  toElement: (config: Config) => Partial<E>;
  defaultConfig: (context: { workspaceSlug: string; projectId?: string }) => Config;
  isValidConfig: (config: Config) => boolean;
  ConfigForm: React.ComponentType<{
    config: Config;
    onChange: (config: Config) => void;
    context: { mode: 'mdx' | 'dashboard'; workspaceSlug: string; projectId?: string };
  }>;
};

type Props<E extends TElement, Config extends Record<string, unknown>> = {
  element: E;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
  spec: MdxConfigSpec<E, Config>;
};

export const MdxWidgetConfigDialog = <E extends TElement, Config extends Record<string, unknown>>({
  element,
  open,
  onClose,
  isNew,
  spec
}: Props<E, Config>) => {
  const editor = useEditorRef();
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const [config, setConfig] = useState<Config>(() =>
    isNew ? spec.defaultConfig({ workspaceSlug, projectId }) : spec.fromElement(element)
  );

  const canSave = spec.isValidConfig(config);
  const ConfigForm = spec.ConfigForm;

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    if (!canSave) {
      if (isNew) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }

    editor.tf.setNodes(spec.toElement(config), { at: path });
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
      title={spec.title}
      width={spec.width ?? 460}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <ConfigForm
          config={config}
          onChange={setConfig}
          context={{ mode: 'mdx', workspaceSlug, projectId }}
        />
      </DialogContent>
    </Dialog>
  );
};
