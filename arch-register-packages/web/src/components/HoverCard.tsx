import { type ReactNode, useRef } from 'react';
import { Popover } from '@diagram-craft/app-components/Popover';
import { useDelayedDisclosure } from '../hooks/useDelayedDisclosure';
import styles from './HoverCard.module.css';

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 120;

type PopoverSide = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
type PopoverAlign = 'start' | 'center' | 'end';

/**
 * Standardized hover-intent popover shell: an anchor span that schedules
 * open/close on hover/focus, and a Popover anchored to it. `content` is only
 * mounted once the popover actually opens, so a data-fetching body passed as
 * `content` fetches lazily on first hover.
 */
export const HoverCard = ({
  children,
  content,
  side = 'top',
  align = 'start',
  sideOffset = 8,
  disabled = false,
  className,
  anchorClassName
}: {
  children: ReactNode;
  content: ReactNode;
  side?: PopoverSide;
  align?: PopoverAlign;
  sideOffset?: number;
  disabled?: boolean;
  className?: string;
  anchorClassName?: string;
}) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const { open, setOpen, scheduleOpen, scheduleClose } = useDelayedDisclosure(
    OPEN_DELAY_MS,
    CLOSE_DELAY_MS
  );

  if (disabled) return <>{children}</>;

  return (
    <>
      <span
        ref={anchorRef}
        className={`${styles.anchor} ${anchorClassName ?? ''}`}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        onClick={() => setOpen(true)}
      >
        {children}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Content
          anchor={anchorRef}
          side={side}
          align={align}
          sideOffset={sideOffset}
          arrow={false}
          focus={false}
          closeButton={false}
          className={`${styles.panel} ${className ?? ''}`}
          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
        >
          <div className={styles.body} onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
            {content}
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};
