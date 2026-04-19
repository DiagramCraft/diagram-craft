import React from 'react';
import { extractDataAttributes, extractMouseEvents } from './utils';
import styles from './ToggleButtonGroup.module.css';
import { Toggle as BaseUIToggle } from '@base-ui/react/toggle';
import { ToggleGroup as BaseUIToggleGroup } from '@base-ui/react/toggle-group';

const Root = (props: RootProps) => {
  const commonProps = {
    'className': styles.cToggleButtonGroup,
    'data-field-state': props.isIndeterminate ? 'indeterminate' : props.state,
    'aria-label': props['aria-label'],
    'disabled': props.disabled,
    ...extractDataAttributes(props),
    ...extractMouseEvents(props)
  };

  if (props.type === 'single') {
    const value = props.value ? [props.value] : [];

    return (
      <BaseUIToggleGroup
        {...commonProps}
        multiple={false}
        value={value}
        onValueChange={v => props.onChange(v[0])}
      >
        {props.children}
      </BaseUIToggleGroup>
    );
  } else {
    return (
      <BaseUIToggleGroup
        {...commonProps}
        multiple={true}
        value={props.value}
        onValueChange={v => props.onChange(v.length > 0 ? v : undefined)}
      >
        {props.children}
      </BaseUIToggleGroup>
    );
  }
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

const Item = React.forwardRef<HTMLButtonElement, ItemProps>((props: ItemProps, ref) => {
  return (
    <BaseUIToggle
      {...props}
      ref={ref}
      className={props.className ?? styles.eItem}
      value={props.value}
      disabled={props.disabled}
    >
      {props.children}
    </BaseUIToggle>
  );
});

type ItemProps = {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
} & React.HTMLAttributes<HTMLButtonElement>;

export const ToggleButtonGroup = {
  Root,
  Item
};
