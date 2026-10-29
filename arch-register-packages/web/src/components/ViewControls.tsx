import type { ReactNode } from 'react';
import styles from './ViewControls.module.css';

type ViewControlsProps = {
  children: ReactNode;
  /**
   * Where the controls are placed:
   * - `page`: below a page's title and description
   * - `tab`: at the top of a tab's contents (the tab provides the spacing)
   * - `view`: bordered config bar at the top of a view
   */
  variant: 'page' | 'tab' | 'view';
  /** Keep everything on one row and scroll horizontally instead of wrapping. */
  nowrap?: boolean;
  className?: string;
};

/** Shared layout for rows of filters, selects and buttons above a table, list or view. */
export const ViewControls = ({ children, variant, nowrap, className }: ViewControlsProps) => (
  <div
    className={[styles.cViewControls, className].filter(Boolean).join(' ')}
    data-variant={variant}
    data-nowrap={nowrap ? '' : undefined}
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
