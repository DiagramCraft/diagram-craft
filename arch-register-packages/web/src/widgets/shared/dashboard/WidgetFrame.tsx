import type { ReactNode } from 'react';
import { TbEdit, TbX } from 'react-icons/tb';
import styles from './WidgetFrame.module.css';
import { WidgetFramedProvider } from './WidgetFramed';
import type { WidgetFrameStyle, WidgetTint } from './widgetFrameSettings';

type Props = {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
  /** Body padding; defaults to true. */
  padded?: boolean;
  /** header: border and header; frame: border only; none: body only. Defaults to header. */
  variant?: WidgetFrameStyle;
  /** Background tint; defaults to the panel background. */
  tint?: WidgetTint;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const WidgetFrame = ({
  title,
  icon,
  children,
  headerActions,
  padded = true,
  variant = 'header',
  tint,
  onEdit,
  onRemove
}: Props) => {
  const bare = variant === 'none';
  return (
    <div className={bare ? styles.bare : styles.frame} data-tint={tint}>
      {variant === 'header' && (
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
      <div className={styles.body} data-frame={'true'} data-padded={padded} data-framed={!bare}>
        <div className={styles.innerBody}>
          <WidgetFramedProvider value={!bare}>{children}</WidgetFramedProvider>
        </div>
      </div>
    </div>
  );
};
