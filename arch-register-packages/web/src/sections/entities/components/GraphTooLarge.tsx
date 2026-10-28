import { TbAlertTriangle } from 'react-icons/tb';
import { MAX_GRAPH_ELEMENTS } from './graphSizeLimit';
import styles from './EntityGraphView.module.css';

/** Shown instead of a graph that has too many elements to draw quickly. */
export const GraphTooLarge = ({
  nodeCount,
  edgeCount,
  hint
}: {
  nodeCount: number;
  edgeCount: number;
  hint: string;
}) => (
  <div className={styles.eEmpty} role="alert">
    <TbAlertTriangle size={22} />
    <div className={styles.eEmptyTitle}>This graph is too large to draw.</div>
    <div>
      It has {nodeCount} nodes and {edgeCount} edges ({nodeCount + edgeCount} elements, the limit is{' '}
      {MAX_GRAPH_ELEMENTS}). {hint}
    </div>
  </div>
);
