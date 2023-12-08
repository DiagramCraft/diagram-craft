import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbX } from 'react-icons/tb';
import * as Popover from '@radix-ui/react-popover';
import React from 'react';
import { IconType } from 'react-icons/lib/cjs/iconBase';

export const ToolbarButtonWithPopover = (props: Props) => {
  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <ReactToolbar.Button className="cmp-toolbar__button">
            <props.icon />
          </ReactToolbar.Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="cmp-popover cmp-popover--toolbar" sideOffset={5}>
            {props.children}
            <Popover.Close className="cmp-popover__close" aria-label="Close">
              <TbX />
            </Popover.Close>
            <Popover.Arrow className="cmp-popover__arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
};

type Props = {
  children: React.ReactNode;
  icon: IconType;
};
