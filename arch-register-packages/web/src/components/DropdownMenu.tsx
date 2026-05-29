import { useState, useEffect, useRef, type ReactNode } from 'react';
import styles from './DropdownMenu.module.css';

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  keepOpen?: boolean;
  onClick: () => void;
};

type DropdownMenuProps = {
  trigger: ReactNode;
  header?: ReactNode;
  items: MenuItem[];
};

export const DropdownMenu = ({ trigger, header, items }: DropdownMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div className={styles.menu}>
          {header && (
            <>
              <div className={styles.header}>{header}</div>
              <div className={styles.separator} />
            </>
          )}
          {items.map(item => (
            <button
              type="button"
              key={item.label}
              className={item.danger ? styles.itemDanger : styles.item}
              onClick={() => {
                if (!item.keepOpen) setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
