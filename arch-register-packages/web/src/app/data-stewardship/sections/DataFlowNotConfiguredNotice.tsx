import styles from './DataFlowNotConfiguredNotice.module.css';

/**
 * The "plain notice, not an empty table" the issue calls for when the API & Integration Catalog
 * app (#3150) — which doesn't exist as an app yet, see `../useDataFlowConfig.ts` — has no Data
 * Flow relation schema in this workspace. Shared by the Classification section's Restricted Flows
 * and Cross-boundary Transfers views; `DatasetDrawer.tsx`'s own inline "Flows"/"Systems" stub text
 * is left as-is, not refactored to use this component.
 */
export const DataFlowNotConfiguredNotice = ({ title }: { title: string }) => (
  <div className={styles.empty}>
    <div className={styles.title}>{title}</div>
    <p className="dim">
      Requires the API &amp; Integration Catalog app (#3150) to be configured for this workspace,
      with a Data Flow relation schema.
    </p>
  </div>
);
