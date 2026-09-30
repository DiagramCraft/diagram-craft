import { MatrixTable } from '../../../components/MatrixTable';
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
 * a thin domain wrapper over the shared `MatrixTable` primitive (#3496). A solid mark is a linked
 * pair whose Control is effective; an outlined (unfilled) mark is linked but not effective; an
 * empty cell has no link at all. Each row ends with its own total (columns it covers); a final
 * summary row gives each column's total, with a red mark standing in for a zero — an uncontrolled
 * risk or asset — instead of the digit "0" (design reference: `rc-trace-mark--gap`).
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
}) => (
  <MatrixTable
    cornerLabel={
      <>
        {controls.length} controls × {columns.length} {dimensionLabel}
        {columns.length === 1 ? '' : 's'}
      </>
    }
    rows={controls.map(control => ({
      id: control.id,
      title: control.name,
      label: (
        <>
          <span className="mono">{control.ref}</span> {control.name}
        </>
      )
    }))}
    columns={columns.map(column => ({ id: column.id, label: column.label, title: column.title }))}
    renderCell={(controlId, columnId) =>
      hasLink(controlId, columnId) && (
        <span
          className={styles.mark + (isControlEffective(controlId) ? '' : ` ${styles.markWeak}`)}
        />
      )
    }
    getCellTitle={(controlId, columnId) => {
      if (!hasLink(controlId, columnId)) return undefined;
      const control = controls.find(c => c.id === controlId);
      const column = columns.find(c => c.id === columnId);
      return control && column ? `${control.name} → ${column.title}` : undefined;
    }}
    rowTotal={{ label: 'total', getValue: id => columnCountByControlId.get(id) ?? 0 }}
    columnTotal={{
      label: `controls per ${dimensionLabel}`,
      getValue: columnId => {
        const n = controlCountByColumnId.get(columnId) ?? 0;
        return n || <span className={`${styles.mark} ${styles.markGap}`} />;
      }
    }}
    onOpenRow={onOpenControl}
    onOpenColumn={onOpenColumn}
    emptyMessage={
      controls.length === 0
        ? 'No controls match these filters.'
        : `No ${dimensionLabel}s to trace against.`
    }
  />
);
