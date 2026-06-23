import { useState } from 'react';
import type React from 'react';
import { TbPencil } from 'react-icons/tb';
import type { PlateElementProps } from 'platejs/react';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { EditorBlock } from '../../editor/EditorBlock';
import styles from './BaseBlockEditable.module.css';

export const BaseBlockEditable = ({
  element,
  children,
  hasValue,
  placeholder,
  content,
  dialog,
  ...props
}: PlateElementProps & {
  hasValue: boolean;
  placeholder: React.ReactNode;
  content: React.ReactNode;
  dialog: (open: boolean, onClose: () => void) => React.ReactNode;
}) => {
  const [dialogOpen, setDialogOpen] = useState(!hasValue);

  return (
    <EditorBlock
      element={element}
      extraContextMenuItems={onClose => (
        <Menu.Item
          onClick={() => {
            setDialogOpen(true);
            onClose();
          }}
        >
          Edit
        </Menu.Item>
      )}
      {...props}
    >
      <div
        contentEditable={false}
        className={styles.wrapper}
        onDoubleClick={hasValue ? () => setDialogOpen(true) : undefined}
      >
        {hasValue ? (
          <>
            {content}
            <button
              type="button"
              className={styles.editBtn}
              onClick={() => setDialogOpen(true)}
              title="Edit"
            >
              <TbPencil size={12} />
            </button>
          </>
        ) : (
          <div onClick={() => setDialogOpen(true)} className={styles.placeholder}>
            {placeholder}
          </div>
        )}
      </div>
      {children}
      {dialog(dialogOpen, () => setDialogOpen(false))}
    </EditorBlock>
  );
};
