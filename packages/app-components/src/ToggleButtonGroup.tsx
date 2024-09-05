import * as RadixToggleGroup from '@radix-ui/react-toggle-group';
import React from 'react';
import { extractDataAttributes } from './utils';
import styles from './ToggleButtonGroup.module.css';
import { ResetContextMenu } from './ResetContextMenu';

const Root = (props: RootProps) => {
  return (
    <ResetContextMenu
      disabled={props.defaultValue === undefined}
      onReset={() => {
        props.onValueChange(undefined);
      }}
    >
      {/* @ts-ignore */}
      <RadixToggleGroup.Root
        className={styles.cmpToggleButtonGroup}
        data-is-default-value={props.isDefaultValue}
        aria-label={props['aria-label']}
        type={props.type}
        value={props.value}
        onValueChange={props.onValueChange}
        disabled={props.disabled}
        {...extractDataAttributes(props)}
      >
        {props.children}
      </RadixToggleGroup.Root>
    </ResetContextMenu>
  );
};

// TODO: Maybe add a third type with at-least one semantics
type RootProps = {
  'children': React.ReactNode;
  'aria-label'?: string;
  'disabled'?: boolean;
  'isDefaultValue'?: boolean;
} & (
  | {
      type: 'single';
      value: string | undefined;
      defaultValue?: string | undefined;
      onValueChange: (v: string | undefined) => void;
    }
  | {
      type: 'multiple';
      value: string[] | undefined;
      defaultValue?: string[] | undefined;
      onValueChange: (v: string[] | undefined) => void;
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
