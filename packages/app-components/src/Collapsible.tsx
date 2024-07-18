import * as RadixCollapsible from '@radix-ui/react-collapsible';
import { ReactNode, useState } from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import styles from './Collapsible.module.css';

export const Collapsible = (props: Props) => {
  const [open, setOpen] = useState(props.defaultOpen);
  return (
    <RadixCollapsible.Root className={styles.cmpCollapsible} open={open} onOpenChange={setOpen}>
      <div className={styles.cmpCollapsibleTrigger}>
        <RadixCollapsible.Trigger asChild>
          <button className={styles.cmpCollapsibleTriggerInner}>
            {open ? <TbChevronDown /> : <TbChevronRight />}
            {props.label}
          </button>
        </RadixCollapsible.Trigger>
      </div>

      <RadixCollapsible.Content className={styles.cmpCollapsibleContent}>
        {props.children}
      </RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
};

type Props = {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
};
