import { TbChevronDown } from 'react-icons/tb';
import React from 'react';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { IconType } from 'react-icons';

export const ToolbarToggleItemWithPopover = (props: Props) => {
  return (
    <>
      <Toolbar.Button
        data-state={props.value ? 'on' : 'off'}
        onClick={() => {
          props.onChange(!props.value);
        }}
      >
        <props.icon />
      </Toolbar.Button>

      <Popover.Root>
        <Popover.Trigger
          element={
            <Toolbar.Button isOverflow>
              <TbChevronDown />
            </Toolbar.Button>
          }
        />
        <Popover.Content sideOffset={5}>{props.children}</Popover.Content>
      </Popover.Root>
    </>
  );
};

type Props = {
  children: React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  icon: IconType;
};
