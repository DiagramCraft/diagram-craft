import type { ReactNode } from 'react';
import styles from './BarList.module.css';

export type BarListRow = {
  id: string;
  label: ReactNode;
  sublabel?: ReactNode;
  effective: number;
  total: number;
  /** Overrides the default `${effective}/${total}` right-aligned text. */
  valueLabel?: ReactNode;
};

/**
 * Shared ratio/coverage bar-list: a stack of labelled rows, each with a filled track sized to
 * `effective / total` and a right-aligned value. Domain logic (colour banding, click targets)
 * stays with the caller, same split as `MatrixGrid`'s `getCellStyle`/`onOpenItem`.
 */
export const BarList = ({
  rows,
  getColor,
  onOpenItem,
  emptyMessage,
  minBarPct = 2
}: {
  rows: readonly BarListRow[];
  getColor: (row: BarListRow) => string;
  onOpenItem?: (id: string) => void;
  emptyMessage?: ReactNode;
  minBarPct?: number;
}) => {
  if (rows.length === 0) {
    return emptyMessage != null ? <div className={styles.empty}>{emptyMessage}</div> : null;
  }

  return (
    <div className={styles.stack}>
      {rows.map(row => {
        const pct =
          row.total <= 0 ? 0 : Math.max(0, Math.min(100, (100 * row.effective) / row.total));
        const content = (
          <>
            <span className={styles.name}>
              <span className={styles.title}>{row.label}</span>
              {row.sublabel != null && <span className={styles.sub}>{row.sublabel}</span>}
            </span>
            <span className={styles.track}>
              <span
                className={styles.fill}
                style={{ width: `${Math.max(minBarPct, pct)}%`, background: getColor(row) }}
              />
            </span>
            <span className={styles.pct}>{row.valueLabel ?? `${row.effective}/${row.total}`}</span>
          </>
        );

        return onOpenItem ? (
          <button
            type="button"
            key={row.id}
            className={styles.row}
            onClick={() => onOpenItem(row.id)}
          >
            {content}
          </button>
        ) : (
          <div key={row.id} className={styles.row} style={{ cursor: 'default' }}>
            {content}
          </div>
        );
      })}
    </div>
  );
};
