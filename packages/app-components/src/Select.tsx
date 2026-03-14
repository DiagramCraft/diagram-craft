import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { usePortal } from './PortalContext';
import styles from './Select.module.css';
import { extractDataAttributes, extractMouseEvents } from './utils';
import React, { CSSProperties, ReactNode } from 'react';
import { disablePropertyEditorTooltip, enablePropertyEditorTooltip } from './Tooltip';
import { Select as BaseUISelect } from '@base-ui/react/select';

const Root = (props: RootProps) => {
  const portal = usePortal();

  const values = React.Children.toArray(props.children).flatMap(child => {
    if (!React.isValidElement<ItemProps>(child)) return [];
    return [{ value: child.props.value, label: child.props.children }];
  });

  const hasValue = values.some(v => v.value === props.value);

  return (
    <BaseUISelect.Root
      onValueChange={v => props.onChange(v ?? undefined)}
      value={props.isIndeterminate ? '' : props.value}
      open={props.open}
      onOpenChange={open => {
        if (open) {
          disablePropertyEditorTooltip();
        } else {
          enablePropertyEditorTooltip();
        }
      }}
    >
      <BaseUISelect.Trigger
        className={styles.cSelectTrigger}
        {...extractDataAttributes(props)}
        {...extractMouseEvents(props)}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        disabled={props.disabled}
        style={props.style ?? {}}
      >
        <BaseUISelect.Value>
          {props.isIndeterminate ? (
            <div style={{ color: 'var(--panel-fg)' }}>···</div>
          ) : !hasValue ? (
            props.placeholder
          ) : (
            (values.find(v => v.value === props.value)!.label ?? props.value ?? '')
          )}
        </BaseUISelect.Value>
        <BaseUISelect.Icon className={styles.eIcon}>
          <TbChevronDown />
        </BaseUISelect.Icon>
      </BaseUISelect.Trigger>

      <BaseUISelect.Portal container={portal}>
        <BaseUISelect.Positioner>
          <BaseUISelect.Popup className={styles.cSelectContent}>
            <BaseUISelect.List className={styles.eList}>
              <BaseUISelect.Group>{props.children}</BaseUISelect.Group>
            </BaseUISelect.List>
          </BaseUISelect.Popup>
        </BaseUISelect.Positioner>
      </BaseUISelect.Portal>
    </BaseUISelect.Root>
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
    <BaseUISelect.Item
      className={styles.eItem}
      key={props.value}
      value={props.value}
      disabled={props.disabled ?? false}
      {...extractDataAttributes(props)}
      onPointerEnter={e => e.stopPropagation()}
      onPointerLeave={e => e.stopPropagation()}
      onPointerMove={e => e.stopPropagation()}
    >
      <BaseUISelect.ItemText className={styles.eItemText}>{props.children}</BaseUISelect.ItemText>
      <BaseUISelect.ItemIndicator className={styles.eItemIndicator}>
        <TbCheck />
      </BaseUISelect.ItemIndicator>
    </BaseUISelect.Item>
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
