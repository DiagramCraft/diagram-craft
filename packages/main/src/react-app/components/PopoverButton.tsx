import * as Popover from '@radix-ui/react-popover';
import { TbX } from 'react-icons/tb';
import React, { useState } from 'react';

export const PopoverButton = (props: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={'cmp-more'}>
      <Popover.Root open={open} onOpenChange={o => setOpen(o)}>
        <Popover.Trigger asChild>
          <button>{props.label}</button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="cmp-popover"
            sideOffset={5}
            onOpenAutoFocus={e => {
              e.preventDefault();
            }}
          >
            {props.children}

            <Popover.Close className="cmp-popover__close" aria-label="Close">
              <TbX />
            </Popover.Close>
            <Popover.Arrow className="cmp-popover__arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

type Props = {
  label: React.ReactNode | string;
  children: React.ReactNode;
};
