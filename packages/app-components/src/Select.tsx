import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { usePortal } from './PortalContext';
import styles from './Select.module.css';
import { extractDataAttributes, extractMouseEvents } from './utils';
import React, { CSSProperties, ReactNode } from 'react';
import { disablePropertyEditorTooltip, enablePropertyEditorTooltip } from './Tooltip';
import { Select as BaseUISelect } from '@base-ui-components/react/select';

const Root = (props: RootProps) => {
  const portal = usePortal();

  const values =
    React.Children.map(props.children, e => {
      // biome-ignore lint/suspicious/noExplicitAny: We know this is an Item
      const props = (e as any).props as ItemProps;
      return { value: props.value, label: props.children };
    }) ?? [];

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
        className={styles.cmpSelectTrigger}
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
        <BaseUISelect.Icon className={styles.cmpSelectTriggerIcon}>
          <TbChevronDown />
        </BaseUISelect.Icon>
      </BaseUISelect.Trigger>

      <BaseUISelect.Portal container={portal}>
        <BaseUISelect.Positioner>
          <BaseUISelect.Popup className={styles.cmpSelectContent}>
            <BaseUISelect.List className={styles.cmpSelectContentViewpoint}>
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
      className={styles.cmpSelectContentItem}
      key={props.value}
      value={props.value}
      disabled={props.disabled ?? false}
      {...extractDataAttributes(props)}
      onPointerEnter={e => e.stopPropagation()}
      onPointerLeave={e => e.stopPropagation()}
      onPointerMove={e => e.stopPropagation()}
    >
      <BaseUISelect.ItemText>{props.children}</BaseUISelect.ItemText>
      <BaseUISelect.ItemIndicator className={styles.cmpSelectContentItemIndicator}>
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
