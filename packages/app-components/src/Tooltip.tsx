import * as RadixTooltip from '@radix-ui/react-tooltip';
import React from 'react';
import styles from './Tooltip.module.css';

export const Tooltip = (props: Props) => {
  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{props.children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={styles.cmpTooltip} sideOffset={5} side={'bottom'}>
            {props.message}
            <RadixTooltip.Arrow className={styles.cmpTooltipArrow} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};

type Props = {
  message: string;
  children: React.ReactNode;
};
