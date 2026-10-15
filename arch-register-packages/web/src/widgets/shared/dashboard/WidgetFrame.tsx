import type { ReactNode } from 'react';
import { TbEdit, TbX } from 'react-icons/tb';
import styles from './WidgetFrame.module.css';

type Props = {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
  /** Body padding; defaults to true. */
  padded?: boolean;
  /** Renders only the body, without border, background or header. */
  bare?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const WidgetFrame = ({
  title,
  icon,
  children,
  headerActions,
  padded = true,
  bare = false,
  onEdit,
  onRemove
}: Props) => (
  <div className={bare ? styles.bare : styles.frame}>
    {!bare && (
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          {icon && <span className={styles.headerIcon}>{icon}</span>}
          <span className={styles.headerText}>{title}</span>
        </div>
        {headerActions && <div className={styles.headerActions}>{headerActions}</div>}
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
      </div>
    )}
    <div className={styles.body} data-frame={'true'} data-padded={padded}>
      <div className={styles.innerBody}>{children}</div>
    </div>
  </div>
);
