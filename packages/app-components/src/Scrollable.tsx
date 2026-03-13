import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './Scrollable.module.css';
import React from 'react';

type ScrollableProps = {
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Scrollable = (props: ScrollableProps) => {
  return (
    <ScrollArea.Root {...props} className={styles.cScrollable}>
      <ScrollArea.Viewport className={styles.eViewport}>
        <ScrollArea.Content className={styles.eContent}>{props.children}</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className={styles.eScrollbar}>
        <ScrollArea.Thumb className={styles.eThumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
};
