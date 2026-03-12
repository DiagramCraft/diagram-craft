import styles from './KeyValueTable.module.css';
import React, { CSSProperties, HTMLAttributes } from 'react';

type RootProps = {
  children: React.ReactNode | React.ReactNode[];
  style?: CSSProperties;
  type?: 'wide' | 'inline';
};

const Root = (props: RootProps) => {
  return (
    <div className={styles.cKeyValueTable} style={props.style} data-type={props.type}>
      {props.children}
    </div>
  );
};

type LabelProps = {
  children?: React.ReactNode | React.ReactNode[];
  valign?: 'top' | 'bottom' | 'middle';
} & HTMLAttributes<HTMLDivElement>;

const VALIGN: Record<NonNullable<LabelProps['valign']>, CSSProperties> = {
  top: { alignSelf: 'start', marginTop: '0.25rem' },
  middle: { alignSelf: 'center' },
  bottom: { alignSelf: 'end' }
};

const Label = (props: LabelProps) => {
  return (
    <div
      {...props}
      className={props.className ? `${styles.eLabel} ${props.className}` : styles.eLabel}
      style={{
        ...VALIGN[props.valign ?? 'middle'],
        ...(props.style ?? {})
      }}
    >
      {props.children}
    </div>
  );
};

type ValueProps = {
  children: React.ReactNode | React.ReactNode[];
} & HTMLAttributes<HTMLDivElement>;

const Value = (props: ValueProps) => {
  return (
    <div {...props} className={styles.eValue}>
      {props.children}
    </div>
  );
};

type FullRowProps = { children: React.ReactNode | React.ReactNode[] };

const FullRow = (props: FullRowProps) => {
  return (
    <div className={styles.eRow} {...props}>
      {props.children}
    </div>
  );
};

export const KeyValueTable = {
  Root,
  Label,
  Value,
  FullRow
};
