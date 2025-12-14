import React from 'react';
import styles from './Toolbar.module.css';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { Toolbar as BaseUIToolbar } from '@base-ui-components/react/toolbar';
import { ToggleButtonGroup } from './ToggleButtonGroup';

const Root = (props: RootProps) => {
  return (
    <BaseUIToolbar.Root
      id={props.id}
      data-direction={props.direction}
      className={styles.cmpToolbar}
      data-size={props.size ?? 'default'}
    >
      {props.children}
    </BaseUIToolbar.Root>
  );
};

type RootProps = {
  children: React.ReactNode;
  size?: 'default' | 'large';
  id?: string;
  direction?: 'horizontal' | 'vertical';
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, forwardedRef) => {
  return (
    <BaseUIToolbar.Button
      {...PropsUtils.filter(props, 'isOverflow')}
      className={`${styles.cmpToolbarButton} ${props.isOverflow ? styles.cmpToolbarButtonMore : ''} ${props.className ?? ''}`}
      ref={forwardedRef}
    >
      {props.children}
    </BaseUIToolbar.Button>
  );
});

type ButtonProps = {
  children: React.ReactNode;
  isOverflow?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const ToggleItem = React.forwardRef<HTMLButtonElement, ToggleItemProps>((props, forwardedRef) => {
  return (
    <ToggleButtonGroup.Item
      {...props}
      className={styles.cmpToolbarButton}
      value={props.value}
      ref={forwardedRef}
    >
      {props.children}
    </ToggleButtonGroup.Item>
  );
});

type ToggleItemProps = {
  children: React.ReactNode;
  value: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const ToggleGroup = (props: ToggleGroupProps) => {
  return (
    // @ts-expect-error
    <ToggleButtonGroup.Root type={props.type} value={props.value} onChange={props.onChange}>
      {props.children}
    </ToggleButtonGroup.Root>
  );
};

type ToggleGroupProps =
  | {
      type: 'single';
      value: string;
      children: React.ReactNode;
      onChange: (s: string | undefined) => void;
    }
  | {
      type: 'multiple';
      value: string[];
      children: React.ReactNode;
      onChange: (s: string[] | undefined) => void;
    };

const Separator = (props: SeparatorProps) => {
  return <BaseUIToolbar.Separator {...props} className={styles.cmpToolbarSeparator} />;
};

type SeparatorProps = React.HTMLAttributes<HTMLDivElement>;

export const Toolbar = {
  Root,
  Button,
  ToggleItem,
  ToggleGroup,
  Separator
};
