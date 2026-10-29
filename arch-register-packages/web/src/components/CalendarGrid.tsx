import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './CalendarGrid.module.css';

export type CalendarGridCell = {
  key: string;
  /** Cell label — pass a styled span if the consumer needs its own label typography. */
  label: ReactNode;
  /** Right-aligned header value — pass a styled span if the consumer needs its own typography. */
  headerRight?: ReactNode;
  /** Stronger border callout for the "current" cell, e.g. this week / this month. */
  emphasized?: boolean;
  children: ReactNode;
};

/**
 * Shared calendar-grid shell: a responsive CSS grid of bordered cells, each with a label/value
 * header row and caller-rendered body. Domain logic (bucketing items into cells, entry styling,
 * captions) stays with the caller — same split `MatrixGrid.tsx` uses for risk-matrix/heatmap
 * grids. Only the structure that's genuinely identical across use cases (grid shell, cell
 * border/flex-column shape, header row layout) is shared here; per-consumer cosmetics (cell
 * padding/min-height/background, label/value typography) stay in the consumer's own CSS module
 * via `cellClassName` and the `label`/`headerRight` content itself.
 *
 * Extracted from `VendorContractsCalendar` (12-month grid) and `DataStewardshipReviewCalendar`
 * (6-week grid) (#3497), which independently built near-identical grid shells differing only in
 * column count, collapse breakpoint and cell cosmetics.
 */
export const CalendarGrid = ({
  cells,
  columns,
  collapseColumns,
  collapseBreakpoint,
  cellClassName
}: {
  cells: readonly CalendarGridCell[];
  columns: number;
  /** Narrower column count to switch to under `collapseBreakpoint`. */
  collapseColumns?: number;
  /** Viewport width (px) below which `collapseColumns` applies. */
  collapseBreakpoint?: number;
  /** Extra class applied to every cell, for consumer-specific padding/min-height/background. */
  cellClassName?: string;
}) => {
  const scopeId = useId();
  const scopeClass = `calendar-grid-${scopeId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      className={`${styles.grid} ${scopeClass}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {collapseColumns && collapseBreakpoint && (
        <style>{`@media (max-width: ${collapseBreakpoint}px) { .${scopeClass} { grid-template-columns: repeat(${collapseColumns}, minmax(0, 1fr)); } }`}</style>
      )}
      {cells.map(cell => (
        <div
          key={cell.key}
          className={[styles.cell, cell.emphasized && styles.cellEmphasized, cellClassName]
            .filter(Boolean)
            .join(' ')}
        >
          <div className={styles.cellHeader}>
            <span>{cell.label}</span>
            {cell.headerRight !== undefined && <span>{cell.headerRight}</span>}
          </div>
          {cell.children}
        </div>
      ))}
    </div>
  );
};
