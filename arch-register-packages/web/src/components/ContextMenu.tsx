import { useEffect, useRef, useLayoutEffect, useState, type ReactNode } from 'react';
import styles from './ContextMenu.module.css';

export type ContextMenuItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  separatorBefore?: boolean;
  onClick: () => void;
};

type ContextMenuProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + r.width + pad > window.innerWidth) left = window.innerWidth - r.width - pad;
    if (top + r.height + pad > window.innerHeight) top = window.innerHeight - r.height - pad;
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top), ready: true });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    // Defer so the opening contextmenu/click doesn't immediately dismiss
    const t = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('contextmenu', close);
      window.addEventListener('resize', close);
      window.addEventListener('wheel', close, { passive: true });
      window.addEventListener('keydown', onKey, true);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('wheel', close);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}
      onMouseDown={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      role="menu"
    >
      {items.map((it, i) => (
        <div key={i}>
          {it.separatorBefore && <div className={styles.separator} />}
          <button
            type="button"
            className={it.danger ? styles.itemDanger : styles.item}
            role="menuitem"
            onClick={() => { onClose(); it.onClick(); }}
          >
            {it.icon && <span>{it.icon}</span>}
            {it.label}
          </button>
        </div>
      ))}
    </div>
  );
};
