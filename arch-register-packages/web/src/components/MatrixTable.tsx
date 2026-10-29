import type { ReactNode } from 'react';
import styles from './MatrixTable.module.css';

export type MatrixTableAxisItem = { id: string; label: ReactNode; title?: string };

/**
 * Shared sticky trace/coverage-matrix table: a real `<table>` with a sticky top-left corner,
 * sticky (rotated, vertical) header row, and sticky first column, plus an optional totals row and
 * column. Domain logic (cell content, totals values, marks/colours) stays with the caller via
 * `renderCell`/`rowTotal`/`columnTotal`.
 *
 * This is a sibling to `./MatrixGrid.tsx`, not built on top of it (#3496): `MatrixGrid` is a
 * bounded, fixed-axis CSS-grid heatmap with chip-list cells and no sticky positioning (5×5 risk
 * matrix, criticality×band vendor matrix). This primitive is for the opposite shape — axes that
 * are unbounded in both directions, needing independent scroll with sticky headers, boolean/mark
 * cells, and row+column totals — which doesn't fit `MatrixGrid`'s API without distorting it for
 * its existing consumers. As with `MatrixGrid` (#3464), this stays a hand-rolled table rather than
 * a table/grid library: it's a labelled sticky grid of interactive cells, not a data-grid with
 * sorting/virtualization needs.
 */
export const MatrixTable = ({
  rows,
  columns,
  cornerLabel,
  renderCell,
  getCellTitle,
  rowTotal,
  columnTotal,
  onOpenRow,
  onOpenColumn,
  emptyMessage
}: {
  rows: readonly MatrixTableAxisItem[];
  columns: readonly MatrixTableAxisItem[];
  cornerLabel: ReactNode;
  renderCell: (rowId: string, columnId: string) => ReactNode;
  getCellTitle?: (rowId: string, columnId: string) => string | undefined;
  rowTotal?: { label: ReactNode; getValue: (rowId: string) => ReactNode };
  columnTotal?: { label: ReactNode; getValue: (columnId: string) => ReactNode };
  onOpenRow?: (id: string) => void;
  onOpenColumn?: (id: string) => void;
  emptyMessage?: ReactNode;
}) => {
  if (rows.length === 0 || columns.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.hd0}>{cornerLabel}</th>
            {columns.map(column => (
              <th key={column.id} title={column.title}>
                {onOpenColumn ? (
                  <button
                    type="button"
                    className={styles.columnButton}
                    aria-label={column.title ? `Open ${column.title}` : undefined}
                    onClick={() => onOpenColumn(column.id)}
                  >
                    <div className={styles.vert}>{column.label}</div>
                  </button>
                ) : (
                  <div className={styles.vert}>{column.label}</div>
                )}
              </th>
            ))}
            {rowTotal && (
              <th className={styles.tot} style={{ width: 44, minWidth: 44 }}>
                <div className={styles.vert}>{rowTotal.label}</div>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              {onOpenRow ? (
                <th
                  onClick={() => onOpenRow(row.id)}
                  title={row.title}
                  className={styles.rowHeaderCellClickable}
                >
                  <span className={styles.rowname}>{row.label}</span>
                </th>
              ) : (
                <th title={row.title}>
                  <span className={styles.rowname}>{row.label}</span>
                </th>
              )}
              {columns.map(column => (
                <td key={column.id} title={getCellTitle?.(row.id, column.id)}>
                  {renderCell(row.id, column.id)}
                </td>
              ))}
              {rowTotal && <td className={styles.tot}>{rowTotal.getValue(row.id)}</td>}
            </tr>
          ))}
          {columnTotal && (
            <tr>
              <th className={styles.totLabel}>{columnTotal.label}</th>
              {columns.map(column => (
                <td key={column.id} className={styles.tot}>
                  {columnTotal.getValue(column.id)}
                </td>
              ))}
              {rowTotal && <td className={styles.tot} />}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
