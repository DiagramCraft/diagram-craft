import type { ReactNode } from 'react';
import { TbMenu2 } from 'react-icons/tb';
import { MenuButton } from './MenuButton';
import styles from './HamburgerMenu.module.css';

type HamburgerMenuProps = {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
};

export const HamburgerMenu = ({ children, align = 'start', className }: HamburgerMenuProps) => (
  <MenuButton.Root>
    <MenuButton.Trigger
      element={
        // Intentionally use a data attribute rather than an id here. Base UI manages trigger ids
        // internally, and overriding the trigger's id caused submenu navigation to break.
        <button
          type="button"
          className={[styles.button, className].filter(Boolean).join(' ')}
          data-hamburger-menu
          aria-label="Open application menu"
        >
          <TbMenu2 size={16} />
        </button>
      }
    />
    <MenuButton.Menu align={align}>{children}</MenuButton.Menu>
  </MenuButton.Root>
);
