import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { TbX } from 'react-icons/tb';
import styles from './Drawer.module.css';

const DRAWER_EXIT_DURATION_MS = 180;

export const Drawer = ({
  onClose,
  eyebrow,
  title,
  badges,
  children,
  footer,
  width,
  active = true,
  stacked = false,
  stackOffset = 0
}: {
  onClose: () => void;
  eyebrow?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  active?: boolean;
  stacked?: boolean;
  stackOffset?: number;
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(onClose, DRAWER_EXIT_DURATION_MS);
  }, [onClose]);

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose, active]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
    },
    []
  );

  return (
    <div
      className={`${styles.root} ${stacked ? styles.stackedRoot : ''}`}
      aria-hidden={!active || undefined}
    >
      {!stacked && (
        <div
          className={`${styles.backdrop} ${isClosing ? styles.backdropClosing : ''}`}
          onClick={requestClose}
        />
      )}
      <div
        className={`${styles.drawer} ${isClosing ? styles.drawerClosing : ''} ${
          stacked && !active ? styles.stackedInactive : ''
        }`}
        style={{
          ...(width != null ? { width } : {}),
          ...(stacked ? { right: `${stackOffset}px` } : {})
        }}
      >
        <div className={styles.head}>
          <div className={styles.headTop}>
            <div className={styles.headActions}>{eyebrow}</div>
            <button
              type="button"
              className={styles.close}
              onClick={requestClose}
              aria-label="Close drawer"
            >
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
