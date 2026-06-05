import { useState, useRef, type ReactNode, type ReactElement } from 'react';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  keepOpen?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type DropdownMenuProps = {
  trigger: ReactNode;
  header?: ReactNode;
  items: MenuItem[];
};

export const DropdownMenu = ({ trigger, header, items }: DropdownMenuProps) => {
  const [open, setOpen] = useState(false);
  const keepOpenRef = useRef(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && keepOpenRef.current) {
      keepOpenRef.current = false;
      return;
    }
    setOpen(nextOpen);
  };

  return (
    <MenuButton.Root open={open} onOpenChange={handleOpenChange}>
      <MenuButton.Trigger element={trigger as ReactElement} />
      <MenuButton.Menu>
        {header && (
          <>
            <div>{header}</div>
            <Menu.Separator />
          </>
        )}
        {items.map(item => (
          <Menu.Item
            key={item.label}
            leftSlot={item.icon as ReactElement | undefined}
            type={item.danger ? 'danger' : 'regular'}
            disabled={item.disabled}
            onClick={() => {
              if (item.keepOpen) keepOpenRef.current = true;
              item.onClick();
            }}
          >
            {item.label}
          </Menu.Item>
        ))}
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
