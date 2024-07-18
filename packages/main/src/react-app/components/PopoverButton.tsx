import React, { useState } from 'react';
import { Popover } from '@diagram-craft/app-components/Popover';

export const PopoverButton = (props: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={'cmp-more'}>
      <Popover.Root open={open} onOpenChange={o => setOpen(o)}>
        <Popover.Trigger>
          <button>{props.label}</button>
        </Popover.Trigger>
        <Popover.Content
          sideOffset={5}
          onOpenAutoFocus={e => {
            e.preventDefault();
          }}
        >
          {props.children}
        </Popover.Content>
      </Popover.Root>
    </div>
  );
};

type Props = {
  label: React.ReactNode | string;
  children: React.ReactNode;
};
