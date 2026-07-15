import type { ReactNode, CSSProperties } from 'react';
import styles from './entityTooltipParts.module.css';

/**
 * Shared leaf-level tooltip markup for HierarchyView/RadarView/BubbleView's hover/pin tooltips.
 * Only pieces whose CSS was byte-identical across the views they're shared between are
 * extracted here - each view's outer tooltip container (positioning, spacing between blocks,
 * hover/pin interaction) stays local since those genuinely differ between Popover-anchored,
 * event-position-anchored, and hover-only tooltips.
 */

export const TooltipRow = ({
  label,
  value,
  valueStyle
}: {
  label: ReactNode;
  value: ReactNode;
  valueStyle?: CSSProperties;
}) => (
  <div className={styles.tooltipRow}>
    <span className={styles.tooltipLabel}>{label}</span>
    <span className={styles.tooltipValue} style={valueStyle}>
      {value}
    </span>
  </div>
);

export const TooltipChips = ({ children }: { children: ReactNode }) => (
  <div className={styles.tooltipChips}>{children}</div>
);

export const TooltipChip = ({
  children,
  style
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <span className={styles.tooltipChip} style={style}>
    {children}
  </span>
);
