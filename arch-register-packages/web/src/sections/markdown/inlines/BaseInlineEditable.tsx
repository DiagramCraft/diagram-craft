import { useState } from 'react';
import type React from 'react';
import { TbPencil } from 'react-icons/tb';
import styles from './BaseInlineEditable.module.css';

export const BaseInlineEditable = ({
  hasValue,
  placeholder,
  dialog,
  children,
}: {
  hasValue: boolean;
  placeholder: React.ReactNode;
  dialog: (open: boolean, onClose: () => void) => React.ReactNode;
  children?: React.ReactNode;
}) => {
  const [dialogOpen, setDialogOpen] = useState(!hasValue);

  return (
    <>
      <span contentEditable={false} className={styles.wrapper} onClick={() => setDialogOpen(true)}>
        {hasValue ? (
          <>
            {children}
            <span className={styles.editButton} title="Edit">
              <TbPencil size={10} />
            </span>
          </>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
      </span>
      {dialog(dialogOpen, () => setDialogOpen(false))}
    </>
  );
};
