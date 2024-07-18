import * as ReactToolbar from '@radix-ui/react-toolbar';
import React from 'react';
import { IconType } from 'react-icons/lib/cjs/iconBase';
import { Popover } from '@diagram-craft/app-components/Popover';

export const ToolbarButtonWithPopover = (props: Props) => {
  return (
    <Popover.Root>
      <Popover.Trigger>
        <ReactToolbar.Button className="cmp-toolbar__button" disabled={props.disabled}>
          <props.icon />
        </ReactToolbar.Button>
      </Popover.Trigger>
      <Popover.Content sideOffset={5}>{props.children}</Popover.Content>
    </Popover.Root>
  );
};

type Props = {
  children: React.ReactNode;
  icon: IconType;
  disabled?: boolean;
};
