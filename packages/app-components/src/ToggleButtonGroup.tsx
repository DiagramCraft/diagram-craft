import React from 'react';
import { extractDataAttributes, extractMouseEvents } from './utils';
import styles from './ToggleButtonGroup.module.css';
import { Toggle as BaseUIToggle } from '@base-ui-components/react/toggle';
import { ToggleGroup as BaseUIToggleGroup } from '@base-ui-components/react/toggle-group';

const Root = (props: RootProps) => {
  return (
    <BaseUIToggleGroup
      className={styles.cmpToggleButtonGroup}
      data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
      aria-label={props['aria-label']}
      multiple={props.type === 'multiple'}
      value={props.type === 'single' ? [props.value] : props.value}
      onValueChange={v => props.onChange(props.type === 'single' ? v[0] : v)}
      disabled={props.disabled}
      {...extractDataAttributes(props)}
      {...extractMouseEvents(props)}
    >
      {props.children}
    </BaseUIToggleGroup>
  );
};

// TODO: Maybe add a third type with at-least one semantics
type RootProps = {
  'children': React.ReactNode;
  'aria-label'?: string;
  'disabled'?: boolean;
  'isIndeterminate'?: boolean;
  'state'?: 'set' | 'unset' | 'overridden';
} & (
  | {
      type: 'single';
      value: string | undefined;
      onChange: (v: string | undefined) => void;
    }
  | {
      type: 'multiple';
      value: string[] | undefined;
      onChange: (v: string[] | undefined) => void;
    }
);

const Item = (props: ItemProps) => {
  return (
    <BaseUIToggle
      className={styles.cmpToggleButtonGroupItem}
      value={props.value}
      disabled={props.disabled}
      {...extractDataAttributes(props)}
    >
      {props.children}
    </BaseUIToggle>
  );
};

type ItemProps = {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
};

export const ToggleButtonGroup = {
  Root,
  Item
};
