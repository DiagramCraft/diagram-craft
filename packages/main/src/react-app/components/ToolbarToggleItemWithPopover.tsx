import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbChevronDown } from 'react-icons/tb';
import React from 'react';
import { IconType } from 'react-icons/lib/cjs/iconBase';
import { Popover } from '@diagram-craft/app-components/Popover';

export const ToolbarToggleItemWithPopover = (props: Props) => {
  return (
    <>
      <ReactToolbar.Button
        className="cmp-toolbar__button"
        data-state={props.value ? 'on' : 'off'}
        onClick={() => {
          props.onChange(!props.value);
        }}
      >
        <props.icon />
      </ReactToolbar.Button>

      <Popover.Root>
        <Popover.Trigger>
          <ReactToolbar.Button className="cmp-toolbar__button cmp-toolbar__button--more">
            <TbChevronDown />
          </ReactToolbar.Button>
        </Popover.Trigger>
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
