import type { ReactNode } from 'react';
import { TbEdit, TbX } from 'react-icons/tb';
import styles from './WidgetFrame.module.css';

type Props = {
  children: ReactNode;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const WidgetFrame = ({ children, onEdit, onRemove }: Props) => (
  <div className={styles.frame}>
    {(onEdit || onRemove) && (
      <div className={`${styles.controls} widgetControls`}>
        {onEdit && (
          <button
            type="button"
            className={styles.controlButton}
            onClick={onEdit}
            title="Edit widget"
          >
            <TbEdit size={12} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            className={styles.controlButton}
            onClick={onRemove}
            title="Remove widget"
          >
            <TbX size={12} />
          </button>
        )}
      </div>
    )}
    <div className={styles.body}>{children}</div>
  </div>
);
