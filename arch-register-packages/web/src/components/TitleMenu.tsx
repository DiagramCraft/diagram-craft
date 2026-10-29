import type { ReactNode } from 'react';
import { TbDots } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DropdownMenu, type MenuItem } from './DropdownMenu';

/** Overflow (…) menu for `Title`'s `menu` prop. Use this so all screens share one trigger. */
export const TitleMenu = ({
  items,
  label = 'Actions',
  header,
  disabled
}: {
  items: MenuItem[];
  /** Accessible name of the trigger button. */
  label?: string;
  header?: ReactNode;
  disabled?: boolean;
}) => (
  <DropdownMenu
    trigger={<Button aria-label={label} icon={<TbDots size={14} />} disabled={disabled} />}
    header={header}
    items={items}
  />
);
