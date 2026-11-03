import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import styles from '../shell/SidePanel.module.css';
import { useAutoFocus } from '../hooks/useAutoFocus';

export const RenameDialog = ({
  open,
  currentName,
  entityType,
  onRename,
  onCancel
}: {
  open: boolean;
  currentName: string;
  entityType: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(inputRef, {
    enabled: open,
    onFocused: element => element.select()
  });

  useEffect(() => {
    if (!open) return;
    setName(currentName);
  }, [open, currentName]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onRename(trimmed);
  };

  return (
    <Dialog open={open} onClose={onCancel} title={`Rename ${entityType}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormElement label="Name">
          <TextInput ref={inputRef} value={name} onChange={value => setName(value ?? '')} />
        </FormElement>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className={styles.renameBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.renameBtnPrimary} disabled={!name.trim()}>
            Rename
          </button>
        </div>
      </form>
    </Dialog>
  );
};
