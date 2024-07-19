import React from 'react';
import styles from './Button.module.css';
import { propsUtils } from '@diagram-craft/utils/propsUtils';
import { DataAttributes } from './utils';

export const Button = React.forwardRef<HTMLButtonElement, Props>((props, forwardedRef) => {
  return (
    // @ts-ignore
    <button
      {...propsUtils.filter(props, 'type')}
      className={`${styles.cmpButton} cmp-button--${props.type ?? 'primary'} ${props.className ?? ''}`}
      ref={forwardedRef}
    >
      {props.children}
    </button>
  );
});

type Props = {
  children: React.ReactNode;
  disabled?: boolean;
  type?: 'primary' | 'secondary' | 'danger' | 'icon-only';
} & Omit<React.HTMLAttributes<HTMLButtonElement>, 'type'> &
  DataAttributes;
