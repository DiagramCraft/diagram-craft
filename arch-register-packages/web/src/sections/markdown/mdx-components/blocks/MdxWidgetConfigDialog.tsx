import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogContent } from '../../editor/BlockDialog';
import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../MdxContext';
import { getConfigDialogWidth } from '../configDialog';
import {
  createDefaultConfig,
  getComponentDefinition,
  isValidComponentConfig
} from '../componentRegistry';

export type MdxConfigSpec<E extends TElement, Config extends Record<string, unknown>> = {
  /** Reads the element's config; `defaults` fills in anything the element doesn't carry. */
  fromElement: (el: E, defaults: Config) => Config;
  toElement: (config: Config) => Partial<E>;
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
  const definition = getComponentDefinition(element.type);

  const [config, setConfig] = useState<Config>(() => {
    if (!definition?.configSchema) {
      throw new Error(`Component "${element.type}" must define a config schema`);
    }
    const defaults = createDefaultConfig(definition, { workspaceSlug, projectId });
    return isNew ? (defaults as Config) : spec.fromElement(element, defaults as Config);
  });

  // The component's own validity rule (structure and completeness) is shared with the dashboard.
  const canSave = isValidComponentConfig(definition, config);
  const ConfigForm = definition?.configForm;

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

  if (!ConfigForm) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={definition?.name ?? element.type}
      width={getConfigDialogWidth(definition?.configDialog)}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <ConfigForm
          config={config}
          onChange={setConfig}
          context={{ mode: 'mdx', surface: projectId ? 'project' : 'workspace' }}
        />
      </DialogContent>
    </Dialog>
  );
};
