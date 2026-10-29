import type { ReactNode } from 'react';
import styles from './ViewControls.module.css';

type ViewControlsProps = {
  children: ReactNode;
  /** `inline` for page-level toolbars, `bar` for the bordered config bar of a view. */
  variant?: 'inline' | 'bar';
  /** Remove the vertical padding, e.g. when the parent already provides spacing. */
  padding?: 'default' | 'none';
  /** Keep everything on one row and scroll horizontally instead of wrapping. */
  nowrap?: boolean;
  /** Add space below the controls, separating them from the content that follows. */
  spaced?: boolean;
  /** Size every nested button (including those inside child components) to match LabeledSelect. */
  compactButtons?: boolean;
  className?: string;
};

/** Shared layout for rows of filters, selects and buttons above a table, list or view. */
export const ViewControls = ({
  children,
  variant = 'inline',
  padding = 'default',
  nowrap,
  spaced,
  compactButtons,
  className
}: ViewControlsProps) => (
  <div
    className={[styles.cViewControls, className].filter(Boolean).join(' ')}
    data-variant={variant}
    data-padding={padding}
    data-nowrap={nowrap ? '' : undefined}
    data-spaced={spaced ? '' : undefined}
    data-compact-buttons={compactButtons ? '' : undefined}
  >
    {children}
  </div>
);

/** Pushes the controls that follow it to the right edge. */
export const ViewControlsSpacer = () => <div className={styles.eSpacer} />;

/** Thin vertical divider between groups of controls. */
export const ViewControlsSeparator = () => <hr className={styles.eSeparator} />;

/** Bordered container for a view that has a `bar` ViewControls on top of its content. */
export const ViewControlsFrame = ({
  children,
  fill,
  className
}: {
  children: ReactNode;
  /** Grow to fill the remaining space of a flex column parent instead of using the full height. */
  fill?: boolean;
  className?: string;
}) => (
  <div
    className={[styles.cViewControlsFrame, className].filter(Boolean).join(' ')}
    data-fill={fill ? '' : undefined}
  >
    {children}
  </div>
);
