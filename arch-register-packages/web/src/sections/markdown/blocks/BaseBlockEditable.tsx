import type React from 'react';
import { TbPencil } from 'react-icons/tb';
import type { PlateElementProps } from 'platejs/react';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { Draggable } from '../Draggable';
import styles from './BaseBlockEditable.module.css';

export const BaseBlockEditable = ({
  element,
  children,
  onEdit,
  placeholder,
  hasValue,
  content,
  ...props
}: PlateElementProps & {
  onEdit: () => void;
  placeholder: React.ReactNode;
  hasValue: boolean;
  content: React.ReactNode;
}) => (
  <Draggable
    element={element}
    extraContextMenuItems={onClose => (
      <Menu.Item
        onClick={() => {
          onEdit();
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
      onDoubleClick={hasValue ? onEdit : undefined}
    >
      {hasValue ? (
        <>
          {content}
          <button type="button" className={styles.editBtn} onClick={onEdit} title="Edit">
            <TbPencil size={12} />
          </button>
        </>
      ) : (
        <div onClick={onEdit} className={styles.placeholder}>
          {placeholder}
        </div>
      )}
    </div>
    {children}
  </Draggable>
);
