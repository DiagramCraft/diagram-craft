import React from 'react';
import styles from './Button.module.css';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { DataAttributes } from './utils';

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps<HTMLButtonElement>>(
  (props, forwardedRef) => {
    return (
      <button
        {...PropsUtils.filter(props, 'variant')}
        className={`${styles.cButton} ${props.className ?? ''}`}
        data-variant={props.variant ?? 'primary'}
        ref={forwardedRef}
      >
        {props.children}
      </button>
    );
  }
);

export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonProps<HTMLAnchorElement>>(
  (props, forwardedRef) => {
    return (
      <a
        {...PropsUtils.filter(props, 'variant')}
        className={`${styles.cButton} ${props.className ?? ''}`}
        data-variant={props.variant ?? 'primary'}
        ref={forwardedRef}
      >
        {props.children}
      </a>
    );
  }
);

export namespace Button {
  export type Props = ButtonProps<HTMLButtonElement>;
}

type ButtonProps<E> = {
  children: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'icon-only';
} & Omit<React.HTMLAttributes<E>, 'type'> &
  DataAttributes;
