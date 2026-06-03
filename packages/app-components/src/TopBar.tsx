import type { ReactNode, HTMLAttributes } from 'react';
import { TbMenu2 } from 'react-icons/tb';
import styles from './TopBar.module.css';

type TopBarProps = {
  children?: ReactNode;
  leftSlot?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export const TopBar = ({ children, leftSlot, className, ...rest }: TopBarProps) => (
  <div className={[styles.topbar, className].filter(Boolean).join(' ')} {...rest}>
    {leftSlot !== undefined ? (
      leftSlot
    ) : (
      <button type="button" className={styles.hamburger}>
        <TbMenu2 size={16} />
      </button>
    )}
    {children}
  </div>
);
