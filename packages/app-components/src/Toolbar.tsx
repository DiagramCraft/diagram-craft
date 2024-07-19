import * as RadixToolbar from '@radix-ui/react-toolbar';
import React from 'react';
import styles from './Toolbar.module.css';

const Root = (props: RootProps) => {
  return (
    <RadixToolbar.Root
      id={props.id}
      data-direction={props.direction}
      className={styles.cmpToolbar}
      data-size={props.size ?? 'default'}
    >
      {props.children}
    </RadixToolbar.Root>
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
    <RadixToolbar.Button
      {...props}
      className={`${styles.cmpToolbarButton} ${props.isOverflow ? styles.cmpToolbarButtonMore : ''} ${props.className ?? ''}`}
      ref={forwardedRef}
    >
      {props.children}
    </RadixToolbar.Button>
  );
});

type ButtonProps = {
  children: React.ReactNode;
  isOverflow?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const ToggleItem = React.forwardRef<HTMLButtonElement, ToggleItemProps>((props, forwardedRef) => {
  return (
    <RadixToolbar.ToggleItem
      {...props}
      className={`${styles.cmpToolbarButton} ${styles.cmpToolbarToggleItem}`}
      value={props.value}
      ref={forwardedRef}
    >
      {props.children}
    </RadixToolbar.ToggleItem>
  );
});

type ToggleItemProps = {
  children: React.ReactNode;
  value: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const ToggleGroup = (props: ToggleGroupProps) => {
  return (
    // @ts-ignore
    <RadixToolbar.ToggleGroup type={props.type} value={props.value}>
      {props.children}
    </RadixToolbar.ToggleGroup>
  );
};

type ToggleGroupProps = {
  type: 'single' | 'multiple';
  children: React.ReactNode;
  value?: string | string[];
};

const Separator = () => {
  return <RadixToolbar.Separator className={styles.cmpToolbarSeparator} />;
};

export const Toolbar = {
  Root,
  Button,
  ToggleItem,
  ToggleGroup,
  Separator
};
