import { ScrollArea } from '@base-ui/react/scroll-area';
import React from 'react';
import styles from './Scrollable.module.css';

type ScrollableProps = {
  children?: React.ReactNode;
  maxHeight?: React.CSSProperties['maxHeight'];
  variant?: 'default' | 'compact';
} & React.ComponentPropsWithoutRef<typeof ScrollArea.Root>;

export const Scrollable = ({
  children,
  className,
  style,
  maxHeight,
  variant,
  ...props
}: ScrollableProps) => {
  const rootStyle = maxHeight === undefined ? style : { ...style, maxHeight };

  return (
    <ScrollArea.Root
      {...props}
      className={className ? `${styles.cScrollable} ${className}` : styles.cScrollable}
      style={rootStyle}
      data-variant={variant ?? 'default'}
    >
      <ScrollArea.Viewport className={styles.eViewport}>
        <ScrollArea.Content className={styles.eContent}>{children}</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className={styles.eScrollbar}>
        <ScrollArea.Thumb className={styles.eThumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
};
