import React from 'react';
import styles from './Button.module.css';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { DataAttributes } from './utils';

const CUSTOM_PROPS = ['variant', 'size', 'icon', 'iconRight'] as const;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps<HTMLButtonElement>>(
  (props, forwardedRef) => {
    return (
      <button
        {...PropsUtils.filter(props, ...CUSTOM_PROPS)}
        className={`${styles.cButton} ${props.className ?? ''}`}
        data-variant={props.variant ?? 'default'}
        data-size={props.size ?? 'md'}
        ref={forwardedRef}
      >
        {props.icon}
        {props.children}
        {props.iconRight}
      </button>
    );
  }
);

export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonProps<HTMLAnchorElement>>(
  (props, forwardedRef) => {
    return (
      <a
        {...PropsUtils.filter(props, ...CUSTOM_PROPS)}
        className={`${styles.cButton} ${props.className ?? ''}`}
        data-variant={props.variant ?? 'default'}
        data-size={props.size ?? 'md'}
        ref={forwardedRef}
      >
        {props.icon}
        {props.children}
        {props.iconRight}
      </a>
    );
  }
);

export namespace Button {
  export type Props = ButtonProps<HTMLButtonElement>;
}

type ButtonProps<E> = {
  children?: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'icon-only';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
} & Omit<React.HTMLAttributes<E>, 'type'> &
  DataAttributes;
