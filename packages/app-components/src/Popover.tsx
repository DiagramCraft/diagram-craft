import * as RadixPopover from '@radix-ui/react-popover';
import { TbX } from 'react-icons/tb';
import React from 'react';
import { usePortal } from './PortalContext';
import styles from './Popover.module.css';

const Root = (props: RootProps) => {
  return (
    <RadixPopover.Root open={props.open} onOpenChange={props.onOpenChange}>
      {props.children}
    </RadixPopover.Root>
  );
};

type RootProps = {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (b: boolean) => void;
};

const Trigger = (props: TriggerProps) => {
  return <RadixPopover.Trigger asChild>{props.children}</RadixPopover.Trigger>;
};

type TriggerProps = {
  children: React.ReactNode;
};

const Content = React.forwardRef<HTMLDivElement, ContentProps>((props, forwardedRef) => {
  const portal = usePortal();
  return (
    <RadixPopover.PopoverPortal container={portal}>
      <RadixPopover.Content
        className={`${styles.cmpPopover} ${props.className ?? ''}`}
        sideOffset={props.sideOffset}
        onOpenAutoFocus={props.onOpenAutoFocus}
        ref={forwardedRef}
      >
        {props.children}

        <RadixPopover.Close className={styles.cmpPopoverClose} aria-label="Close">
          <TbX />
        </RadixPopover.Close>
        <RadixPopover.Arrow className={styles.cmpPopoverArrow} />
      </RadixPopover.Content>
    </RadixPopover.PopoverPortal>
  );
});

type ContentProps = {
  children: React.ReactNode;
  sideOffset?: number;
  onOpenAutoFocus?: (e: Event) => void;
  className?: string;
};

const Anchor = (props: AnchorProps) => {
  return <RadixPopover.Anchor asChild>{props.children}</RadixPopover.Anchor>;
};

type AnchorProps = {
  children: React.ReactNode;
};

export const Popover = {
  Root,
  Anchor,
  Trigger,
  Content
};
