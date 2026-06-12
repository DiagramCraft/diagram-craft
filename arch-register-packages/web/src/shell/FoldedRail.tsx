import { useState, useRef, useEffect, type ReactNode } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import styles from './FoldedRail.module.css';

// --- FoldedRail ---
// 44px strip shown when a sidebar is collapsed.
// Hover reveals the full sidebar as an overlay flyout.
// Clicking the strip while the flyout is open docks the sidebar (calls onExpand).
export const FoldedRail = ({
  label,
  onExpand,
  children,
}: {
  label: string;
  onExpand: () => void;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const enter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };
  const leave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 160);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className={`${styles.rail} ${open ? styles.isOpen : ''}`}>
      <div
        className={styles.strip}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onClick={open ? () => { setOpen(false); onExpand(); } : undefined}
      >
        <span className={styles.label}>{label}</span>
        <div className={styles.hint}>
          <TbChevronRight size={9} style={{ transform: 'rotate(90deg)' }} />
        </div>
      </div>

      {open && (
        <div className={styles.flyout} onMouseEnter={enter} onMouseLeave={leave}>
          {children}
        </div>
      )}
    </div>
  );
};

// --- NavSidebar ---
// Full 280px sidebar wrapper. Rendered when the user pins the sidebar open.
export const NavSidebar = ({ children }: { children: ReactNode }) => {
  return (
    <div className={styles.navSidebar}>
      {children}
    </div>
  );
};
