import styles from './RiskComplianceTraceMatrix.module.css';

export type RiskComplianceTraceMatrixRow = {
  id: string;
  /** e.g. the Control's `_publicId` — rendered as a mono prefix before `name`, mirroring the
   *  design reference's `c.ref`. */
  ref: string;
  name: string;
};

export type RiskComplianceTraceMatrixColumn = {
  id: string;
  /** Vertical header text — `ref + " " + name` for risks, just `name` for assets, mirroring the
   *  design reference's `x.ref + " " + x.title` / `x.name` (`rc-views.jsx`). */
  label: string;
  /** Full-name tooltip, since the vertical header clips at a fixed height. */
  title: string;
};

/**
 * Control × risk/asset traceability grid for the Controls section's Traceability view (#3282) —
 * a real `<table>` with a sticky top-left corner, sticky header row (vertical, rotated column
 * labels), and a sticky first column (control names), mirroring the design reference's
 * `RCControls` matrix view (`rc-views.jsx`'s `rc-trace` table, styled by `rc.css`) rather than a
 * bespoke CSS grid. A solid mark is a linked pair whose Control is effective; an outlined
 * (unfilled) mark is linked but not effective; an empty cell has no link at all. Each row ends
 * with its own total (columns it covers); a final summary row gives each column's total, with a
 * red mark standing in for a zero — an uncontrolled risk or asset — instead of the digit "0"
 * (design reference: `rc-trace-mark--gap`). Neither axis is bounded (unlike the fixed 5×5
 * `RiskComplianceMatrix`), so both scroll together under the sticky header/first column.
 *
 * Control row headers open the shared entity drawer. Asset column headers may also be interactive
 * when the caller provides `onOpenColumn`; Risk column headers and totals remain read-only.
 */
export const RiskComplianceTraceMatrix = ({
  controls,
  columns,
  dimensionLabel,
  hasLink,
  isControlEffective,
  controlCountByColumnId,
  columnCountByControlId,
  onOpenControl,
  onOpenColumn
}: {
  controls: RiskComplianceTraceMatrixRow[];
  columns: RiskComplianceTraceMatrixColumn[];
  dimensionLabel: 'risk' | 'asset';
  hasLink: (controlId: string, columnId: string) => boolean;
  isControlEffective: (controlId: string) => boolean;
  controlCountByColumnId: Map<string, number>;
  columnCountByControlId: Map<string, number>;
  onOpenControl: (id: string) => void;
  onOpenColumn?: (id: string) => void;
}) => {
  if (controls.length === 0 || columns.length === 0) {
    return (
      <div className={styles.empty}>
        {controls.length === 0
          ? 'No controls match these filters.'
          : `No ${dimensionLabel}s to trace against.`}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.trace}>
        <thead>
          <tr>
            <th className={styles.hd0}>
              {controls.length} controls × {columns.length} {dimensionLabel}
              {columns.length === 1 ? '' : 's'}
            </th>
            {columns.map(column => (
              <th key={column.id} title={column.title}>
                {onOpenColumn ? (
                  <button
                    type="button"
                    className={styles.columnButton}
                    aria-label={`Open ${dimensionLabel} ${column.title}`}
                    onClick={() => onOpenColumn(column.id)}
                  >
                    <div className={styles.vert}>{column.label}</div>
                  </button>
                ) : (
                  <div className={styles.vert}>{column.label}</div>
                )}
              </th>
            ))}
            <th className={styles.tot} style={{ width: 44, minWidth: 44 }}>
              <div className={styles.vert}>total</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {controls.map(control => (
            <tr key={control.id}>
              <th onClick={() => onOpenControl(control.id)} className={styles.rowHeaderCell}>
                <span className={styles.rowname}>
                  <span className="mono">{control.ref}</span> {control.name}
                </span>
              </th>
              {columns.map(column => {
                const linked = hasLink(control.id, column.id);
                return (
                  <td key={column.id} title={linked ? `${control.name} → ${column.title}` : ''}>
                    {linked && (
                      <span
                        className={
                          styles.mark +
                          (isControlEffective(control.id) ? '' : ` ${styles.markWeak}`)
                        }
                      />
                    )}
                  </td>
                );
              })}
              <td className={styles.tot}>{columnCountByControlId.get(control.id) ?? 0}</td>
            </tr>
          ))}
          <tr>
            <th className={styles.totLabel}>controls per {dimensionLabel}</th>
            {columns.map(column => {
              const n = controlCountByColumnId.get(column.id) ?? 0;
              return (
                <td
                  key={column.id}
                  className={styles.tot}
                  style={{ color: n ? undefined : 'var(--cmp-fg-danger, #ef4444)' }}
                >
                  {n || <span className={`${styles.mark} ${styles.markGap}`} />}
                </td>
              );
            })}
            <td className={styles.tot} />
          </tr>
        </tbody>
      </table>
    </div>
  );
};
