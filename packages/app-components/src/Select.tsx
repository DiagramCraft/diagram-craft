import * as ReactSelect from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { usePortal } from './PortalContext';
import styles from './Select.module.css';
import { extractDataAttributes } from './utils';
import { CSSProperties, ReactNode } from 'react';
import { ResetContextMenu } from './ResetContextMenu';

const Root = (props: RootProps) => {
  const portal = usePortal();

  const isDefaultValue =
    !props.hasMultipleValues &&
    props.isDefaultValue &&
    props.defaultValue !== undefined &&
    props.value === props.defaultValue;

  return (
    <ReactSelect.Root
      onValueChange={props.onValueChange}
      value={props.hasMultipleValues ? undefined : props.value}
      open={props.open}
    >
      <ResetContextMenu
        disabled={props.defaultValue === undefined}
        onReset={() => {
          props.onValueChange(undefined);
        }}
      >
        <ReactSelect.Trigger
          className={styles.cmpSelectTrigger}
          {...extractDataAttributes(props)}
          data-is-default-value={isDefaultValue}
          disabled={props.disabled}
          style={props.style ?? {}}
        >
          <ReactSelect.Value
            placeholder={
              props.hasMultipleValues ? (
                <div style={{ color: 'var(--primary-fg)' }}>···</div>
              ) : (
                props.placeholder ?? ''
              )
            }
          />
          <ReactSelect.Icon className={styles.cmpSelectTriggerIcon}>
            <TbChevronDown />
          </ReactSelect.Icon>
        </ReactSelect.Trigger>
      </ResetContextMenu>
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
  value: string | undefined;
  defaultValue?: string;
  isDefaultValue?: boolean;
  onValueChange: (value: string | undefined) => void;
  open?: boolean;
  disabled?: boolean;
  placeholder?: string;
  style?: CSSProperties;
};

const Item = (props: ItemProps) => {
  return (
    <ReactSelect.Item
      className={styles.cmpSelectContentItem}
      key={props.value}
      value={props.value}
      disabled={props.disabled ?? false}
      {...extractDataAttributes(props)}
    >
      <ReactSelect.ItemText>{props.children}</ReactSelect.ItemText>
      <ReactSelect.ItemIndicator className={styles.cmpSelectContentItemIndicator}>
        <TbCheck />
      </ReactSelect.ItemIndicator>
    </ReactSelect.Item>
  );
};

type ItemProps = {
  value: string;
  children: ReactNode;
  disabled?: boolean;
};

export const Select = {
  Root,
  Item
};
