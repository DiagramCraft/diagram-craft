import * as ReactSelect from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { usePortal } from './PortalContext';
import styles from './Select.module.css';
import { extractDataAttributes, extractMouseEvents } from './utils';
import { CSSProperties, ReactNode } from 'react';
import { disablePropertyEditorTooltip, enablePropertyEditorTooltip } from './Tooltip';

const Root = (props: RootProps) => {
  const portal = usePortal();

  return (
    <ReactSelect.Root
      onValueChange={props.onChange}
      value={props.isIndeterminate ? undefined : props.value}
      open={props.open}
      onOpenChange={open => {
        if (open) {
          disablePropertyEditorTooltip();
        } else {
          enablePropertyEditorTooltip();
        }
      }}
    >
      <ReactSelect.Trigger
        className={styles.cmpSelectTrigger}
        {...extractDataAttributes(props)}
        {...extractMouseEvents(props)}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        disabled={props.disabled}
        style={props.style ?? {}}
      >
        <ReactSelect.Value
          placeholder={
            props.isIndeterminate ? (
              <div style={{ color: 'var(--panel-fg)' }}>···</div>
            ) : (
              (props.placeholder ?? '')
            )
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
  isIndeterminate?: boolean;
  children: ReactNode;
  state?: 'set' | 'unset' | 'overridden';
  value: string | undefined;
  onChange: (value: string | undefined) => void;
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
      onPointerEnter={e => {
        console.log('enter');
        e.stopPropagation();
      }}
      onPointerLeave={e => {
        console.log('leave');
        e.stopPropagation();
      }}
      onPointerMove={e => {
        console.log('move');
        e.stopPropagation();
      }}
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
