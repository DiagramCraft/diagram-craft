import * as ReactSelect from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { usePortal } from './PortalContext';
import styles from './Select.module.css';
import { extractDataAttributes } from './utils';
import { ReactNode } from 'react';

const Root = (props: RootProps) => {
  const portal = usePortal();
  return (
    <ReactSelect.Root
      onValueChange={props.onValueChange}
      value={props.hasMultipleValues ? undefined : props.value}
      open={props.open}
    >
      <ReactSelect.Trigger
        className={styles.cmpSelectTrigger}
        {...extractDataAttributes(props)}
        disabled={props.disabled}
      >
        <ReactSelect.Value
          placeholder={
            props.hasMultipleValues ? <div style={{ color: 'var(--primary-fg)' }}>···</div> : ''
          }
        />
        <ReactSelect.Icon className={styles.cmpSelectTriggerIcon}>
          <TbChevronDown />
        </ReactSelect.Icon>
      </ReactSelect.Trigger>
      <ReactSelect.Portal container={portal}>
        <ReactSelect.Content className={styles.cmpSelectContent}>
          <ReactSelect.Viewport className={styles.cmpSelectContentViewpoint}>
            <ReactSelect.Group>{props.children}</ReactSelect.Group>
          </ReactSelect.Viewport>
        </ReactSelect.Content>
      </ReactSelect.Portal>
    </ReactSelect.Root>
  );
};
type RootProps = {
  hasMultipleValues?: boolean;
  children: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  open?: boolean;
  disabled?: boolean;
};

const Item = (props: ItemProps) => {
  return (
    <ReactSelect.Item
      className={styles.cmpSelectContentItem}
      key={props.value}
      value={props.value}
      {...extractDataAttributes(props)}
    >
      <ReactSelect.ItemText>{props.children}</ReactSelect.ItemText>
      <ReactSelect.ItemIndicator className={styles.cmpSelectContentIndicator}>
        <TbCheck />
      </ReactSelect.ItemIndicator>
    </ReactSelect.Item>
  );
};

type ItemProps = {
  value: string;
  children: ReactNode;
};

export const Select = {
  Root,
  Item
};
