import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ColorPicker } from '../../../../../components/ColorPicker';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import type { LabelSlateElement } from './types';
import styles from './LabelDialog.module.css';

export const LabelDialog = ({
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
  const el = element as LabelSlateElement;

  const [text, setText] = useState(el.content ?? '');
  const [color, setColor] = useState(el.color ?? SCHEMA_COLORS[0]!);

  const canSave = text.trim().length > 0;

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

    editor.tf.setNodes({ content: text.trim(), color }, { at: path });
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
      title="Label"
      width={360}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Text">
          <input
            type="text"
            className={styles.textInput}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g. Draft"
            autoFocus
          />
        </DialogSection>

        <DialogSection label="Color">
          <ColorPicker value={color} onChange={c => setColor(c ?? SCHEMA_COLORS[0]!)} />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
