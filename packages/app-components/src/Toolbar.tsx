import React, { CSSProperties } from 'react';
import styles from './Toolbar.module.css';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { Toolbar as BaseUIToolbar } from '@base-ui/react/toolbar';
import { ToggleButtonGroup } from './ToggleButtonGroup';

const Root = (props: RootProps) => {
  return (
    <BaseUIToolbar.Root
      id={props.id}
      data-direction={props.direction}
      className={styles.cToolbar}
      data-size={props.size ?? 'default'}
      style={props.style}
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
  style?: CSSProperties;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, forwardedRef) => {
  return (
    <BaseUIToolbar.Button
      {...PropsUtils.filter(props, 'isDropdown')}
      className={`${styles.eButton} ${props.isDropdown ? styles.eDropdownButton : ''} ${props.className ?? ''}`}
      ref={forwardedRef}
    >
      {props.children}
    </BaseUIToolbar.Button>
  );
});

type ButtonProps = {
  children: React.ReactNode;
  isDropdown?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const ToggleItem = React.forwardRef<HTMLButtonElement, ToggleItemProps>((props, forwardedRef) => {
  return (
    <ToggleButtonGroup.Item
      {...props}
      className={styles.eButton}
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
  return <BaseUIToolbar.Separator {...props} className={styles.eSeparator} />;
};

type SeparatorProps = React.HTMLAttributes<HTMLDivElement>;

export const Toolbar = {
  Root,
  Button,
  ToggleItem,
  ToggleGroup,
  Separator
};
