import * as RadixToggleGroup from '@radix-ui/react-toggle-group';
import React from 'react';
import { extractDataAttributes, extractMouseEvents } from './utils';
import styles from './ToggleButtonGroup.module.css';

const Root = (props: RootProps) => {
  return (
    /* @ts-ignore */
    <RadixToggleGroup.Root
      className={styles.cmpToggleButtonGroup}
      data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
      aria-label={props['aria-label']}
      type={props.type}
      value={props.value}
      onValueChange={props.onChange}
      disabled={props.disabled}
      {...extractDataAttributes(props)}
      {...extractMouseEvents(props)}
    >
      {props.children}
    </RadixToggleGroup.Root>
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
    <RadixToggleGroup.Item
      className={styles.cmpToggleButtonGroupItem}
      value={props.value}
      disabled={props.disabled}
      {...extractDataAttributes(props)}
    >
      {props.children}
    </RadixToggleGroup.Item>
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
