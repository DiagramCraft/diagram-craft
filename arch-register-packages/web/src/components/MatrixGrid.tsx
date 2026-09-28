import type { CSSProperties, ReactNode } from 'react';
import styles from './MatrixGrid.module.css';

export type MatrixGridAxis = { key: string | number; label: ReactNode };
export type MatrixGridItem = { id: string; label: string; title?: string };
export type MatrixGridCellStyle = {
  /** Tint colour of the cell. */
  color: string;
  /** Stronger border/tint callout, e.g. "outside appetite" or "hot". */
  emphasized?: boolean;
  /** Small score shown in the cell's bottom-right corner. */
  score?: number;
};

export const matrixCellKey = (rowKey: string | number, columnKey: string | number): string =>
  `${rowKey}:${columnKey}`;

/**
 * Shared risk-matrix / heatmap grid: a labelled CSS grid of tinted cells, each listing clickable
 * item chips. Domain logic (bucketing items into cells, colours, emphasis) stays with the caller.
 *
 * Chart-primitive decision (#3464): this stays hand-rolled div/CSS rather than adopting a chart
 * library (recharts/visx/d3). A matrix is a labelled grid of interactive chips, not a plotted
 * chart, and a library would add bundle weight and awkward click/a11y ergonomics. Revisit only
 * when a widget needs continuous axes (time series, scatter).
 */
export const MatrixGrid = ({
  columns,
  rows,
  cornerLabel,
  cells,
  getCellStyle,
  onOpenItem,
  legend,
  footNote,
  rowHeaderWidth = 92,
  cellAspect = true
}: {
  columns: readonly MatrixGridAxis[];
  rows: readonly MatrixGridAxis[];
  cornerLabel: ReactNode;
  cells: ReadonlyMap<string, readonly MatrixGridItem[]>;
  getCellStyle: (rowKey: string | number, columnKey: string | number) => MatrixGridCellStyle;
  onOpenItem: (id: string) => void;
  legend?: readonly { label: string; color: string }[];
  footNote?: ReactNode;
  rowHeaderWidth?: number;
  /** Fixed 2:1 cell aspect ratio; when false, cells size to their content (min-height 40px). */
  cellAspect?: boolean;
}) => (
  <div className={styles.scroll}>
    <div
      className={styles.matrix}
      style={
        {
          gridTemplateColumns: `${rowHeaderWidth}px repeat(${columns.length}, minmax(0, 1fr))`
        } as CSSProperties
      }
    >
      <div className={styles.corner}>
        <div>{cornerLabel}</div>
      </div>
      {columns.map(column => (
        <div key={column.key} className={styles.columnHeader}>
          {column.label}
        </div>
      ))}
      {rows.map(row => (
        <div key={row.key} className={styles.row}>
          <div className={styles.rowHeader}>{row.label}</div>
          {columns.map(column => {
            const items = cells.get(matrixCellKey(row.key, column.key)) ?? [];
            const { color, emphasized, score } = getCellStyle(row.key, column.key);
            return (
              <div
                key={column.key}
                className={styles.cell}
                data-fixed-aspect={cellAspect || undefined}
                data-emphasized={emphasized || undefined}
                style={{ '--cell-color': color } as CSSProperties}
              >
                {items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.tag}
                    title={item.title}
                    onClick={() => onOpenItem(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
                {score !== undefined && <span className={styles.score}>{score}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
    {(legend || footNote) && (
      <div className={styles.foot}>
        {legend && (
          <div className={styles.legend}>
            {legend.map(entry => (
              <span key={entry.label} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: entry.color }} />
                {entry.label}
              </span>
            ))}
          </div>
        )}
        {footNote && <span className={styles.footNote}>{footNote}</span>}
      </div>
    )}
  </div>
);
