import * as ReactToggleGroup from '@radix-ui/react-toggle-group';
import React from 'react';
import { extractDataAttributes } from './utils';
import module from './ToggleButtonGroup.module.css';

// TODO: Change to use radix ToggleGroup
const Root = (props: RootProps) => {
  return (
    // @ts-ignore
    <ReactToggleGroup.Root
      className={`cmp-toolbar ${module.root}`}
      aria-label={props['aria-label']}
      type={props.type}
      value={props.value}
      onValueChange={props.onValueChange}
      {...extractDataAttributes(props)}
    >
      {props.children}
    </ReactToggleGroup.Root>
  );
};

// TODO: Maybe add a third type with at-least one semantics
type RootProps = {
  'children': React.ReactNode;
  'aria-label'?: string;
} & (
  | { type: 'single'; value: string | undefined; onValueChange: (v: string) => void }
  | { type: 'multiple'; value: string[] | undefined; onValueChange: (v: string[]) => void }
);

const Item = (props: ItemProps) => {
  return (
    <ReactToggleGroup.Item
      className="cmp-toolbar__toggle-item"
      value={props.value}
      {...extractDataAttributes(props)}
    >
      {props.children}
    </ReactToggleGroup.Item>
  );
};

type ItemProps = {
  value: string;
  children: React.ReactNode;
};

export const ToggleButtonGroup = {
  Root,
  Item
};
