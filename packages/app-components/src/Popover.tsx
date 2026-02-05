import { TbX } from 'react-icons/tb';
import React from 'react';
import { usePortal } from './PortalContext';
import styles from './Popover.module.css';
import { Popover as BaseUIPopover } from '@base-ui/react/popover';

const Root = (props: RootProps) => {
  return (
    <BaseUIPopover.Root open={props.open} onOpenChange={props.onOpenChange}>
      {props.children}
    </BaseUIPopover.Root>
  );
};

type RootProps = {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (b: boolean) => void;
};

const Trigger = (props: TriggerProps) => {
  return <BaseUIPopover.Trigger render={props.element} />;
};

type TriggerProps = {
  element: React.ReactElement;
};

const Content = React.forwardRef<HTMLDivElement, ContentProps>((props, forwardedRef) => {
  const portal = usePortal();
  return (
    <BaseUIPopover.Portal container={portal}>
      <BaseUIPopover.Positioner sideOffset={(props.sideOffset ?? 0) + 6} anchor={props.anchor}>
        <BaseUIPopover.Viewport>
          <BaseUIPopover.Popup
            className={`${styles.cmpPopover} ${props.className ?? ''}`}
            ref={forwardedRef}
            initialFocus={props.focus !== undefined ? props.focus : false}
          >
            <BaseUIPopover.Arrow className={styles.cmpPopoverArrow} />

            {props.children}

            <BaseUIPopover.Close className={styles.cmpPopoverClose} aria-label="Close">
              <TbX />
            </BaseUIPopover.Close>
          </BaseUIPopover.Popup>
        </BaseUIPopover.Viewport>
      </BaseUIPopover.Positioner>
    </BaseUIPopover.Portal>
  );
});

type ContentProps = {
  children: React.ReactNode;
  sideOffset?: number;
  className?: string;
  focus?: boolean;
  anchor?: React.RefObject<Element | null>;
};

export const Popover = {
  Root,
  Trigger,
  Content
};
