import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import tableStyles from './Table.module.css';
import styles from './NameCell.module.css';

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

type NameContentProps = {
  icon?: ReactNode;
  prefix?: ReactNode;
  indentLevel?: number;
  title: ReactNode;
  subtitle?: ReactNode;
  titleMuted?: boolean;
};

type CellProps = NameContentProps & {
  sticky?: boolean;
  width?: number | string;
  // 'prefix' is also a global RDFa HTML attribute (typed as string) that ComponentPropsWithoutRef<'td'>
  // would otherwise contribute, colliding with our ReactNode-typed prop of the same name.
} & Omit<ComponentPropsWithoutRef<'td'>, 'title' | 'prefix'>;

// The content of a name cell without the surrounding <td>, for cells rendered inside e.g. DataTable
const Content = ({ icon, prefix, indentLevel, title, subtitle, titleMuted }: NameContentProps) => (
  <div className={styles.name} style={indentLevel ? { paddingLeft: indentLevel * 20 } : undefined}>
    {prefix}
    {icon}
    <div>
      <div className={cx(styles.nameMain, titleMuted && styles.nameMuted)}>{title}</div>
      {subtitle && <div className={styles.nameSub}>{subtitle}</div>}
    </div>
  </div>
);

// A complete <td> for hand-written tables
const Cell = ({
  icon,
  prefix,
  indentLevel,
  title,
  subtitle,
  titleMuted,
  sticky,
  width,
  className,
  style,
  ...rest
}: CellProps) => (
  <td
    className={cx(tableStyles.td, sticky && tableStyles.stickyCol, className)}
    style={
      width !== undefined || style
        ? { ...(width !== undefined ? { width } : {}), ...style }
        : undefined
    }
    {...rest}
  >
    <Content
      icon={icon}
      prefix={prefix}
      indentLevel={indentLevel}
      title={title}
      subtitle={subtitle}
      titleMuted={titleMuted}
    />
  </td>
);

export const NameCell = { Cell, Content };
