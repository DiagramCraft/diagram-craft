import type React from 'react';
import { TbPencil } from 'react-icons/tb';
import styles from './BaseInlineEditable.module.css';

export const BaseInlineEditable = ({
  onEdit,
  placeholder,
  hasValue,
  children
}: {
  onEdit: () => void;
  placeholder: React.ReactNode;
  hasValue: boolean;
  children?: React.ReactNode;
}) => (
  <span contentEditable={false} className={styles.wrapper} onClick={onEdit}>
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
);
