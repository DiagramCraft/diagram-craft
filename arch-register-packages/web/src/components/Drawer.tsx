import { useEffect, type ReactNode } from 'react';
import { TbX } from 'react-icons/tb';
import styles from './Drawer.module.css';

export const Drawer = ({
  onClose,
  eyebrow,
  title,
  badges,
  children,
  footer,
  width
}: {
  onClose: () => void;
  eyebrow?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
}) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.root}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.drawer} style={width != null ? { width } : undefined}>
        <div className={styles.head}>
          <div className={styles.headTop}>
            {eyebrow}
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <TbX size={14} />
            </button>
          </div>
          <div className={styles.title}>{title}</div>
          {badges && <div className={styles.badges}>{badges}</div>}
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.foot}>{footer}</div>}
      </div>
    </div>
  );
};
