import { TbX } from 'react-icons/tb';
import React from 'react';
import { usePortal } from './PortalContext';
import styles from './Popover.module.css';
import { Popover as BaseUIPopover } from '@base-ui/react/popover';

type PopoverSide = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
type PopoverAlign = 'start' | 'center' | 'end';
type PopoverCollisionAvoidance =
  | {
      side?: 'flip' | 'none';
      align?: 'flip' | 'shift' | 'none';
      fallbackAxisSide?: 'start' | 'end' | 'none';
    }
  | {
      side?: 'shift' | 'none';
      align?: 'shift' | 'none';
      fallbackAxisSide?: 'start' | 'end' | 'none';
    };

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
      <BaseUIPopover.Positioner
        side={props.side}
        align={props.align}
        sideOffset={(props.sideOffset ?? 0) + 6}
        anchor={props.anchor}
        arrowPadding={props.arrowPadding}
        collisionAvoidance={props.collisionAvoidance}
      >
        <BaseUIPopover.Viewport>
          <BaseUIPopover.Popup
            className={`${styles.cPopover} ${props.className ?? ''}`}
            ref={forwardedRef}
            initialFocus={props.focus !== undefined ? props.focus : false}
          >
            {props.arrow !== false && <BaseUIPopover.Arrow className={styles.eArrow} />}

            {props.children}

            <BaseUIPopover.Close className={styles.eClose} aria-label="Close">
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
  side?: PopoverSide;
  align?: PopoverAlign;
  arrow?: boolean;
  arrowPadding?: number;
  collisionAvoidance?: PopoverCollisionAvoidance;
};

export const Popover = {
  Root,
  Trigger,
  Content
};
