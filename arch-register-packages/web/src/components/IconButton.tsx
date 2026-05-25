import { type ReactNode } from 'react';
import styles from './IconButton.module.css';

type IconButtonProps = {
  active?: boolean;
  title?: string;
  onClick?: () => void;
  children: ReactNode;
  tone?: 'default' | 'primary' | 'ghost';
};

export const IconButton = ({
  active,
  title,
  onClick,
  children,
  tone = 'default',
}: IconButtonProps) => (
  <button
    title={title}
    onClick={onClick}
    className={`${styles.btn} ${active ? styles.active : ''} ${tone === 'primary' ? styles.primary : ''} ${tone === 'ghost' ? styles.ghost : ''}`}
  >
    {children}
  </button>
);
