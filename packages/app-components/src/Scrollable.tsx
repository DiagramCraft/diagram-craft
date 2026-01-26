import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './Scrollable.module.css';
import React from 'react';

type ScrollableProps = {
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Scrollable = (props: ScrollableProps) => {
  return (
    <ScrollArea.Root {...props} className={styles.cmpScrollable}>
      <ScrollArea.Viewport className={styles.cmpScrollableViewport}>
        <ScrollArea.Content className={styles.cmpScrollableContent}>
          {props.children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className={styles.cmpScrollableScrollbar}>
        <ScrollArea.Thumb className={styles.cmpScrollableThumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
};
