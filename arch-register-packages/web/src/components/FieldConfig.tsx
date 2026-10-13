import { type ReactNode, type RefCallback } from 'react';

import { TbGripVertical } from 'react-icons/tb';

import styles from './FieldConfig.module.css';

type FieldConfigProps = {
  dragHandleRef: RefCallback<HTMLElement>;
  menu?: ReactNode;
  options?: ReactNode;
  /**
   * A tall cell (typically a description text area) shown to the right of the other cells. When
   * set, the remaining cells wrap into a three-column grid and this one spans both rows.
   */
  description?: ReactNode;
  children: ReactNode;
};

export const FieldConfig = ({
  dragHandleRef,
  menu,
  options,
  description,
  children
}: FieldConfigProps) => (
  <div className={styles.card}>
    <div className={styles.head}>
      <span className={styles.handle} ref={dragHandleRef}>
        <TbGripVertical size={14} />
      </span>
      {description === undefined ? (
        children
      ) : (
        <div className={styles.grid}>
          {children}
          <div className={styles.description}>{description}</div>
        </div>
      )}
      {menu && <span className={styles.menu}>{menu}</span>}
    </div>
    {options != null && <div className={styles.options}>{options}</div>}
  </div>
);

type FieldConfigCellProps = {
  label: string;
  flexBasis?: number | string;
  mono?: boolean;
  children: ReactNode;
};

const Cell = ({ label, flexBasis, mono, children }: FieldConfigCellProps) => (
  <div className={styles.cell} style={flexBasis === undefined ? undefined : { flexBasis }}>
    <span className={styles.sublabel}>{label}</span>
    <span className={mono ? styles.mono : undefined}>{children}</span>
  </div>
);

FieldConfig.Cell = Cell;
