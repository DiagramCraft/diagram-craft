import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbChevronDown, TbX } from 'react-icons/tb';
import * as Popover from '@radix-ui/react-popover';
import React from 'react';
import { IconType } from 'react-icons/lib/cjs/iconBase';

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
        <Popover.Trigger asChild>
          <ReactToolbar.Button className="cmp-toolbar__button cmp-toolbar__button--more">
            <TbChevronDown />
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
  value: boolean;
  onChange: (v: boolean) => void;
  icon: IconType;
};
