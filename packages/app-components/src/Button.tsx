import React from 'react';
import styles from './Button.module.css';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { DataAttributes } from './utils';

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, forwardedRef) => {
  return (
    // @ts-expect-error
    <button
      {...PropsUtils.filter(props, 'type')}
      className={`${styles.cButton} ${props.className ?? ''}`}
      data-variant={props.type ?? 'primary'}
      ref={forwardedRef}
    >
      {props.children}
    </button>
  );
});

// TODO: Do we really need LinkButton when Button is there already?
export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonProps>(
  (props, forwardedRef) => {
    return (
      // @ts-expect-error
      <a
        {...PropsUtils.filter(props, 'type')}
        className={`${styles.cButton} ${props.className ?? ''}`}
        data-variant={props.type ?? 'primary'}
        ref={forwardedRef}
      >
        {props.children}
      </a>
    );
  }
);

export namespace Button {
  export type Props = ButtonProps;
}

type ButtonProps = {
  children: React.ReactNode;
  disabled?: boolean;
  type?: 'primary' | 'secondary' | 'danger' | 'icon-only';
} & Omit<React.HTMLAttributes<HTMLButtonElement>, 'type'> &
  DataAttributes;
