import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode
} from 'react';
import { TbChevronDown, TbChevronUp, TbDots } from 'react-icons/tb';
import styles from './Table.module.css';
import type { SortState } from './useTableSort';

type Align = 'left' | 'center' | 'right';

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const stopClick: MouseEventHandler<HTMLTableCellElement> = ev => ev.stopPropagation();

// CheckboxCell has no `width` prop (its width is fixed by .checkboxCell in CSS), so sticky-offset
// accumulation below needs this value to fall back on when a sticky CheckboxCell omits it.
const CHECKBOX_CELL_WIDTH = 32;

type StickyCellProps = { sticky?: boolean; width?: number | string; style?: CSSProperties };

const withStickyOffsets = (children: ReactNode): ReactNode => {
  let left = 0;
  return Children.map(children, child => {
    if (!isValidElement<StickyCellProps>(child) || !child.props.sticky) return child;
    const offset = left;
    const width = typeof child.props.width === 'number'
      ? child.props.width
      : child.type === CheckboxCell
        ? CHECKBOX_CELL_WIDTH
        : 0;
    left += width;
    return cloneElement(child as ReactElement<StickyCellProps>, {
      style: { ...child.props.style, left: offset }
    });
  });
};

type TableRootProps = {
  scroll?: boolean;
  stickyHeader?: boolean;
  layout?: 'auto' | 'fixed';
  wrapClassName?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<'table'>, 'className'>;

const Root = ({
  scroll = false,
  stickyHeader = false,
  layout = 'auto',
  wrapClassName,
  className,
  children,
  ...rest
}: TableRootProps) => (
  <div className={cx(styles.wrap, scroll && styles.wrapScroll, wrapClassName)}>
    <table
      className={cx(
        styles.table,
        stickyHeader && styles.stickyHeader,
        layout === 'fixed' && styles.fixedLayout,
        className
      )}
      {...rest}
    >
      {children}
    </table>
  </div>
);

const Head = (props: ComponentPropsWithoutRef<'thead'>) => <thead {...props} />;
const Body = (props: ComponentPropsWithoutRef<'tbody'>) => <tbody {...props} />;

type TableRowProps = {
  selected?: boolean;
  muted?: boolean;
} & ComponentPropsWithoutRef<'tr'>;

const Row = ({ selected, muted, onClick, className, children, ...rest }: TableRowProps) => (
  <tr
    className={cx(
      onClick && styles.rowClickable,
      selected && styles.rowSelected,
      muted && styles.rowMuted,
      className
    )}
    onClick={onClick}
    {...rest}
  >
    {withStickyOffsets(children)}
  </tr>
);

type CellSharedProps = {
  align?: Align;
  numeric?: boolean;
  sticky?: boolean;
  width?: number | string;
};

const cellStyle = (
  width: number | string | undefined,
  style: CSSProperties | undefined
): CSSProperties | undefined => {
  if (width === undefined && !style) return undefined;
  return { ...(width !== undefined ? { width } : {}), ...style };
};

const alignClass = (align: Align | undefined, numeric: boolean | undefined) => {
  if (numeric) return styles.numeric;
  if (align === 'right') return styles.alignRight;
  if (align === 'center') return styles.alignCenter;
  return undefined;
};

type HeaderCellProps = CellSharedProps & ComponentPropsWithoutRef<'th'>;

const HeaderCell = ({
  align,
  numeric,
  sticky,
  width,
  className,
  style,
  ...rest
}: HeaderCellProps) => (
  <th
    className={cx(styles.th, alignClass(align, numeric), sticky && styles.stickyCol, className)}
    style={cellStyle(width, style)}
    {...rest}
  />
);

type CellProps = CellSharedProps & {
  interactive?: boolean;
} & ComponentPropsWithoutRef<'td'>;

const Cell = ({
  align,
  numeric,
  sticky,
  width,
  interactive,
  className,
  style,
  onClick,
  ...rest
}: CellProps) => (
  <td
    className={cx(styles.td, alignClass(align, numeric), sticky && styles.stickyCol, className)}
    style={cellStyle(width, style)}
    onClick={interactive ? (onClick ?? stopClick) : onClick}
    {...rest}
  />
);

type SortableHeaderCellProps<K extends string = string> = {
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  children: ReactNode;
} & Omit<HeaderCellProps, 'children'>;

const SortableHeaderCell = <K extends string = string>({
  sortKey,
  sort,
  onSort,
  children,
  ...rest
}: SortableHeaderCellProps<K>) => {
  const active = sort?.key === sortKey;
  return (
    <HeaderCell aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} {...rest}>
      <button type="button" className={styles.sortButton} onClick={() => onSort(sortKey)}>
        {children}
        {active && (sort!.dir === 'asc' ? <TbChevronUp size={12} /> : <TbChevronDown size={12} />)}
      </button>
    </HeaderCell>
  );
};

type TableCheckboxProps = {
  indeterminate?: boolean;
  'aria-label': string;
} & Omit<ComponentPropsWithoutRef<'input'>, 'type'>;

const Checkbox = ({ indeterminate = false, className, ...rest }: TableCheckboxProps) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return <input ref={ref} type="checkbox" className={cx(styles.checkbox, className)} {...rest} />;
};

type CheckboxCellProps = TableCheckboxProps & { as?: 'td' | 'th'; sticky?: boolean; style?: CSSProperties };

const CheckboxCell = ({ as = 'td', sticky, style, ...rest }: CheckboxCellProps) => {
  const Tag = as;
  return (
    <Tag
      className={cx(as === 'th' ? styles.th : styles.td, styles.checkboxCell, sticky && styles.stickyCol)}
      style={style}
      onClick={stopClick}
    >
      <Checkbox {...rest} />
    </Tag>
  );
};

type NameCellProps = {
  icon?: ReactNode;
  prefix?: ReactNode;
  indentLevel?: number;
  title: ReactNode;
  subtitle?: ReactNode;
  titleMuted?: boolean;
  sticky?: boolean;
  width?: number | string;
} & Omit<ComponentPropsWithoutRef<'td'>, 'title'>;

const NameCell = ({
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
}: NameCellProps) => (
  <td
    className={cx(styles.td, sticky && styles.stickyCol, className)}
    style={cellStyle(width, style)}
    {...rest}
  >
    <div className={styles.name} style={indentLevel ? { paddingLeft: indentLevel * 20 } : undefined}>
      {prefix}
      {icon}
      <div>
        <div className={cx(styles.nameMain, titleMuted && styles.nameMuted)}>{title}</div>
        {subtitle && <div className={styles.nameSub}>{subtitle}</div>}
      </div>
    </div>
  </td>
);

type ActionsCellProps = ComponentPropsWithoutRef<'td'>;

const ActionsCell = ({ className, onClick, ...rest }: ActionsCellProps) => (
  <td className={cx(styles.td, styles.actionsCell, className)} onClick={onClick ?? stopClick} {...rest} />
);

type DotsButtonProps = { 'aria-label'?: string } & ComponentPropsWithoutRef<'button'>;

const DotsButton = forwardRef<HTMLButtonElement, DotsButtonProps>(
  ({ className, 'aria-label': ariaLabel = 'Actions', ...rest }, ref) => (
    <button ref={ref} type="button" className={cx(styles.dotsBtn, className)} aria-label={ariaLabel} {...rest}>
      <TbDots size={14} />
    </button>
  )
);
DotsButton.displayName = 'DotsButton';

type EmptyRowProps = { colSpan: number; title?: ReactNode; children?: ReactNode };

const EmptyRow = ({ colSpan, title, children }: EmptyRowProps) => (
  <tr className={styles.emptyRow}>
    <td className={styles.td} colSpan={colSpan}>
      {title ?? children}
    </td>
  </tr>
);

export const Table = {
  Root,
  Head,
  Body,
  Row,
  HeaderCell,
  SortableHeaderCell,
  Cell,
  NameCell,
  Checkbox,
  CheckboxCell,
  ActionsCell,
  DotsButton,
  EmptyRow
};
