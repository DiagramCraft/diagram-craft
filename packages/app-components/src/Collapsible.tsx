import { ReactNode, useState } from 'react';
import { TbMinus, TbPlus } from 'react-icons/tb';
import styles from './Collapsible.module.css';
import { Collapsible as BaseUICollapsible } from '@base-ui/react/collapsible';

export const Collapsible = (props: Props) => {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <BaseUICollapsible.Root
      className={styles.cCollapsible}
      open={open}
      onOpenChange={setOpen}
      defaultOpen={props.defaultOpen}
    >
      <div className={styles.eTrigger}>
        <BaseUICollapsible.Trigger
          render={p => (
            <button {...p} type="button" className={styles.eTriggerInner}>
              <div>{props.label}</div>
              <div>{open ? <TbMinus /> : <TbPlus />}</div>
            </button>
          )}
        />
      </div>

      <BaseUICollapsible.Panel className={styles.eContent}>
        {props.children}
      </BaseUICollapsible.Panel>
    </BaseUICollapsible.Root>
  );
};

type Props = {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
};
